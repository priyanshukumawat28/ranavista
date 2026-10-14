import { Router } from 'express';
import { Notification, Plan, Review, Enquiry } from '../models/misc.js';
import User from '../models/User.js';
import RFQ from '../models/RFQ.js';
import Order from '../models/Order.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { upload, fileToRef } from '../middleware/upload.js';
import { planFor } from '../utils/plans.js';
import { CONTAINERS } from '../utils/container.js';
import * as pay from '../services/stripe.js';
import { notifyAdmins } from '../services/notify.js';
import { CATEGORIES, SOURCING_COUNTRIES } from '../utils/catalog.js';

const r = Router();

/* ================= PUBLIC ================= */
r.get('/public/meta', ah(async (req, res) => {
  const [sellers, orders] = await Promise.all([
    User.countDocuments({ role: 'seller', 'seller.approval': 'approved' }),
    Order.countDocuments({ paymentStatus: { $in: ['held', 'released'] } }),
  ]);
  res.json({ categories: CATEGORIES, countries: SOURCING_COUNTRIES, containers: CONTAINERS, stats: { sellers, orders } });
}));

r.get('/public/plans', ah(async (req, res) => {
  const plans = await Plan.find({ active: true }).sort('audience sort').select('-stripePriceId').lean();
  res.json(plans);
}));

r.post('/public/contact', ah(async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) throw new HttpError(400, 'Name, email and message are required.');
  const e = await Enquiry.create(req.body);
  notifyAdmins({ type: 'enquiry', title: 'New website enquiry', body: `${name} (${email})`, link: '/enquiries' }, ['support']);
  res.status(201).json({ ok: true, id: e._id });
}));

/* ================= AUTHENTICATED ================= */
r.use(auth);

/* ---------- Uploads ---------- */
r.post('/uploads', upload.array('files', 5), ah(async (req, res) => res.json((req.files || []).map(fileToRef))));

r.post('/seller/documents', allow('seller'), upload.array('files', 5), ah(async (req, res) => {
  req.user.seller.documents.push(...(req.files || []).map(fileToRef));
  await req.user.save();
  res.json(req.user.seller.documents);
}));

/* ---------- Notifications ---------- */
r.get('/notifications', ah(async (req, res) => {
  const list = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(50).lean();
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ list, unread });
}));
r.post('/notifications/read', ah(async (req, res) => {
  const q = { user: req.user._id };
  if (req.body.id) q._id = req.body.id;
  await Notification.updateMany(q, { read: true });
  res.json({ ok: true });
}));

/* ---------- Dashboard summary ---------- */
r.get('/dashboard', ah(async (req, res) => {
  const u = req.user;
  const plan = await planFor(u);
  if (u.role === 'buyer') {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [open, quotesWaiting, activeOrders, spent, usedThisMonth] = await Promise.all([
      RFQ.countDocuments({ buyer: u._id, status: { $in: ['pending', 'assigned', 'quoted', 'negotiating'] } }),
      RFQ.countDocuments({ buyer: u._id, status: { $in: ['quoted', 'negotiating'] } }),
      Order.countDocuments({ buyer: u._id, paymentStatus: { $in: ['unpaid', 'held', 'disputed'] } }),
      Order.aggregate([{ $match: { buyer: u._id, paymentStatus: { $in: ['held', 'released'] } } }, { $group: { _id: null, t: { $sum: '$total' } } }]),
      RFQ.countDocuments({ buyer: u._id, createdAt: { $gte: start } }),
    ]);
    return res.json({ plan, stats: { open, quotesWaiting, activeOrders, spent: spent[0]?.t || 0, usedThisMonth } });
  }
  if (u.role === 'seller') {
    const [newLeads, quoted, activeOrders, earned, held] = await Promise.all([
      RFQ.countDocuments({ assignedSeller: u._id, status: 'assigned' }),
      RFQ.countDocuments({ assignedSeller: u._id, status: { $in: ['quoted', 'negotiating'] } }),
      Order.countDocuments({ seller: u._id, fulfillment: { $in: ['processing', 'shipped'] } }),
      Order.aggregate([{ $match: { seller: u._id, paymentStatus: 'released' } }, { $group: { _id: null, t: { $sum: '$sellerPayout' } } }]),
      Order.aggregate([{ $match: { seller: u._id, paymentStatus: { $in: ['held', 'disputed'] } } }, { $group: { _id: null, t: { $sum: '$sellerPayout' } } }]),
    ]);
    return res.json({ plan, stats: { newLeads, quoted, activeOrders, earned: earned[0]?.t || 0, held: held[0]?.t || 0, rating: u.seller.rating, ratingCount: u.seller.ratingCount } });
  }
  res.json({ plan });
}));

/* ---------- Reviews about me ---------- */
r.get('/reviews/me', ah(async (req, res) => {
  res.json(await Review.find({ to: req.user._id, hidden: false }).sort('-createdAt').populate('from', 'name company').populate('order', 'number'));
}));

/* ---------- Subscriptions ---------- */
r.get('/subscription', ah(async (req, res) => {
  const plans = await Plan.find({ audience: req.user.role, active: true }).sort('sort').select('-stripePriceId');
  res.json({ current: await planFor(req.user), subscription: req.user.subscription, plans, demo: !pay.stripe });
}));

r.post('/subscription/checkout', allow('buyer', 'seller'), ah(async (req, res) => {
  const plan = await Plan.findOne({ key: req.body.planKey, audience: req.user.role, active: true });
  if (!plan) throw new HttpError(404, 'Plan not found.');
  if (plan.priceMonthly === 0) {
    await pay.cancelSubscription(req.user.subscription?.stripeSubscriptionId);
    req.user.subscription = { ...req.user.subscription.toObject(), plan: plan.key, status: 'active', stripeSubscriptionId: undefined };
    await req.user.save();
    return res.json({ switched: true });
  }
  const session = await pay.subscriptionCheckout(req.user, plan);
  if (session.demo) {
    // Demo mode (no Stripe key or no price id on the plan): activate instantly for testing
    req.user.subscription = { ...req.user.subscription.toObject(), plan: plan.key, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 864e5) };
    await req.user.save();
    return res.json({ switched: true, demo: true });
  }
  res.json({ url: session.url });
}));

r.post('/subscription/portal', ah(async (req, res) => {
  const url = await pay.billingPortal(req.user);
  if (!url) throw new HttpError(400, 'Billing portal is available once you have a paid subscription.');
  res.json({ url });
}));

/* ---------- Seller payouts (Stripe Connect) ---------- */
r.get('/payouts', allow('seller'), ah(async (req, res) => {
  const s = req.user.seller;
  if (s.stripeAccountId) {
    const st = await pay.accountStatus(s.stripeAccountId);
    if (st.payoutsEnabled !== s.payoutsEnabled) { s.payoutsEnabled = st.payoutsEnabled; await req.user.save(); }
  }
  const orders = await Order.find({ seller: req.user._id, paymentStatus: { $in: ['held', 'released', 'disputed'] } })
    .select('number sellerPayout platformFee total paymentStatus releasedAt paidAt').sort('-createdAt').lean();
  res.json({ connected: !!s.stripeAccountId, payoutsEnabled: s.payoutsEnabled, orders, demo: !pay.stripe });
}));

r.post('/payouts/onboard', allow('seller'), ah(async (req, res) => {
  const s = req.user.seller;
  if (!s.stripeAccountId) {
    const acct = await pay.createSellerAccount(req.user);
    s.stripeAccountId = acct.id;
    if (acct.demo) s.payoutsEnabled = true;
    await req.user.save();
  }
  res.json({ url: await pay.onboardingLink(s.stripeAccountId) });
}));

r.post('/payouts/dashboard', allow('seller'), ah(async (req, res) => {
  const url = await pay.dashboardLink(req.user.seller.stripeAccountId);
  if (!url) throw new HttpError(400, 'Stripe dashboard is not available in demo mode.');
  res.json({ url });
}));

export default r;

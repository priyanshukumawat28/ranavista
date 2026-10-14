import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import RFQ from '../models/RFQ.js';
import Quote from '../models/Quote.js';
import Order from '../models/Order.js';
import { Dispute, Plan, AuditLog, Message, Review, Enquiry } from '../models/misc.js';
import { auth, allow, adminRole } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { audit } from '../utils/audit.js';
import { notify } from '../services/notify.js';
import { releaseOrder, refundOrder } from '../services/orders.js';
import { cancelSubscription } from '../services/stripe.js';
import { containerFill } from '../utils/container.js';
import env from '../config/env.js';

const r = Router();
r.use(auth, allow('admin'));

const ALL = adminRole('super', 'finance', 'support', 'category');
const ROUTING = adminRole('category', 'support');
const FINANCE = adminRole('finance');
const SUPPORT = adminRole('support', 'finance');
const SUPER = adminRole('super');
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const oid = (id) => new mongoose.Types.ObjectId(String(id));

function canRouteCategory(req, category) {
  if (req.user.adminRole !== 'category' || !req.user.adminCategories?.length) return true;
  return req.user.adminCategories.includes(category);
}

/* ======================= OVERVIEW ======================= */
r.get('/overview', ALL, ah(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [pending, overdue, sellersPending, openDisputes, held, monthFees, gmvSeries, plansActive, recentRfqs, statusCounts] = await Promise.all([
    RFQ.countDocuments({ status: 'pending' }),
    RFQ.countDocuments({ status: 'assigned', responseDueAt: { $lt: now } }),
    User.countDocuments({ role: 'seller', 'seller.approval': 'pending' }),
    Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } }),
    Order.aggregate([{ $match: { paymentStatus: { $in: ['held', 'disputed'] } } }, { $group: { _id: null, t: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'released', releasedAt: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: '$platformFee' } } }]),
    Order.aggregate([
      { $match: { paidAt: { $gte: sixMonths } } },
      { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, gmv: { $sum: '$total' }, fees: { $sum: '$platformFee' }, n: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    User.aggregate([{ $match: { 'subscription.status': 'active' } }, { $group: { _id: '$subscription.plan', n: { $sum: 1 } } }]),
    RFQ.find().sort('-createdAt').limit(6).populate('buyer', 'company name').select('number title category status createdAt').lean(),
    RFQ.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const plans = await Plan.find().lean();
  const mrr = plansActive.reduce((s, p) => s + (plans.find((x) => x.key === p._id)?.priceMonthly || 0) * p.n, 0);
  const series = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hit = gmvSeries.find((g) => g._id.y === d.getFullYear() && g._id.m === d.getMonth() + 1);
    series.push({ label: d.toLocaleString('en-US', { month: 'short' }), gmv: hit?.gmv || 0, fees: hit?.fees || 0, orders: hit?.n || 0 });
  }
  res.json({
    kpis: { pending, overdue, sellersPending, openDisputes, held: held[0]?.t || 0, monthFees: monthFees[0]?.t || 0, mrr },
    series, recentRfqs, statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.n])),
  });
}));

/* ======================= RFQ QUEUE & LEAD ROUTING ======================= */
r.get('/rfqs', ALL, ah(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
  if (req.query.category) q.category = req.query.category;
  if (req.query.overdue === '1') Object.assign(q, { status: 'assigned', responseDueAt: { $lt: new Date() } });
  if (req.query.q) q.$or = [{ number: rx(req.query.q) }, { title: rx(req.query.q) }];
  if (req.user.adminRole === 'category' && req.user.adminCategories?.length) q.category = { $in: req.user.adminCategories };
  const list = await RFQ.find(q).sort(req.query.status === 'pending' ? 'createdAt' : '-createdAt').limit(300)
    .populate('buyer', 'name company subscription.plan').populate('assignedSeller', 'company name').populate('lockedBy', 'name').lean();
  res.json(list);
}));

r.get('/rfqs/:id', ALL, ah(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id)
    .populate('buyer', 'name company email phone address subscription createdAt')
    .populate('assignedSeller', 'name company email seller')
    .populate('assignedBy', 'name')
    .populate('lockedBy', 'name')
    .populate('history.seller', 'company name')
    .populate('history.by', 'name role');
  if (!rfq) throw new HttpError(404, 'RFQ not found.');
  const [quotes, messages, order] = await Promise.all([
    Quote.find({ rfq: rfq._id }).populate('seller', 'company name').sort('-createdAt'),
    Message.find({ rfq: rfq._id }).sort('createdAt').populate('sender', 'name company role'),
    Order.findOne({ rfq: rfq._id }).select('number paymentStatus fulfillment total'),
  ]);
  res.json({ rfq, quotes, messages, order, fill: rfq.containerType !== 'none' ? containerFill(rfq.items, rfq.containerType) : null });
}));

/** Seller Selection Panel — category-matching approved sellers with rating & tier, best first. */
r.get('/rfqs/:id/candidates', ROUTING, ah(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id).select('category history');
  if (!rfq) throw new HttpError(404, 'RFQ not found.');
  const q = { role: 'seller', status: 'active', 'seller.approval': 'approved' };
  if (req.query.all !== '1') q['seller.categories'] = rfq.category;
  if (req.query.q) q.$or = [{ company: rx(req.query.q) }, { name: rx(req.query.q) }];
  const sellers = await User.find(q).select('name company seller subscription createdAt').lean();
  const plans = await Plan.find({ audience: 'seller' }).lean();
  const openLoads = await RFQ.aggregate([
    { $match: { assignedSeller: { $in: sellers.map((s) => s._id) }, status: { $in: ['assigned', 'quoted', 'negotiating'] } } },
    { $group: { _id: '$assignedSeller', n: { $sum: 1 } } },
  ]);
  const previously = new Set(rfq.history.filter((h) => h.seller).map((h) => String(h.seller)));
  const out = sellers.map((s) => {
    const active = s.subscription?.status === 'active';
    const plan = plans.find((p) => p.key === (active ? s.subscription.plan : 'seller_starter')) || plans.find((p) => p.key === 'seller_starter');
    const sd = s.seller || {};
    return {
      _id: s._id, name: s.name, company: s.company, country: sd.country, categories: sd.categories,
      rating: sd.rating || 0, ratingCount: sd.ratingCount || 0, leadsReceived: sd.leadsReceived || 0, leadsQuoted: sd.leadsQuoted || 0,
      responseRate: sd.leadsReceived ? Math.round(((sd.leadsQuoted || 0) / sd.leadsReceived) * 100) : null,
      payoutsEnabled: !!sd.payoutsEnabled, openLeads: openLoads.find((o) => String(o._id) === String(s._id))?.n || 0,
      plan: plan?.name || 'Starter', planKey: plan?.key, priority: plan?.limits?.priority || 0, previouslyAssigned: previously.has(String(s._id)),
    };
  });
  out.sort((a, b) => b.priority - a.priority || b.rating - a.rating || a.openLeads - b.openLeads);
  res.json(out);
}));

/** Assignment lock — stops two admins working the same RFQ at once (5 min). */
r.post('/rfqs/:id/lock', ROUTING, ah(async (req, res) => {
  const now = new Date();
  const rfq = await RFQ.findOneAndUpdate(
    { _id: req.params.id, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: null }, { lockedUntil: { $lt: now } }, { lockedBy: req.user._id }] },
    { lockedBy: req.user._id, lockedUntil: new Date(now.getTime() + 5 * 60 * 1000) },
    { new: true }
  ).populate('lockedBy', 'name');
  if (!rfq) {
    const cur = await RFQ.findById(req.params.id).populate('lockedBy', 'name');
    throw new HttpError(423, `${cur?.lockedBy?.name || 'Another admin'} is working on this RFQ right now.`);
  }
  res.json({ lockedBy: rfq.lockedBy, lockedUntil: rfq.lockedUntil });
}));

r.post('/rfqs/:id/unlock', ROUTING, ah(async (req, res) => {
  await RFQ.updateOne({ _id: req.params.id, lockedBy: req.user._id }, { $unset: { lockedBy: 1, lockedUntil: 1 } });
  res.json({ ok: true });
}));

async function pushLead(req, mode) {
  const { sellerId, hours = env.leadResponseHours, note } = req.body;
  const seller = await User.findOne({ _id: sellerId, role: 'seller', status: 'active', 'seller.approval': 'approved' });
  if (!seller) throw new HttpError(400, 'Choose an approved, active seller.');
  const rfq = await RFQ.findById(req.params.id);
  if (!rfq) throw new HttpError(404, 'RFQ not found.');
  if (!canRouteCategory(req, rfq.category)) throw new HttpError(403, 'This category is outside your assignment.');
  const expectStatus = mode === 'assign' ? 'pending' : 'assigned';
  if (rfq.status !== expectStatus) throw new HttpError(409, mode === 'assign' ? 'This RFQ was already assigned.' : 'Only assigned (not yet quoted) RFQs can be reassigned.');
  if (rfq.lockedBy && String(rfq.lockedBy) !== String(req.user._id) && rfq.lockedUntil > new Date()) throw new HttpError(423, 'Another admin holds the lock on this RFQ.');
  if (mode === 'reassign' && String(rfq.assignedSeller) === String(seller._id)) throw new HttpError(400, 'Pick a different seller.');

  const prevSeller = rfq.assignedSeller;
  const now = new Date();
  // Atomic update guarded by status → single-seller guarantee even under concurrent clicks
  const updated = await RFQ.findOneAndUpdate(
    { _id: rfq._id, status: expectStatus },
    {
      status: 'assigned', assignedSeller: seller._id, assignedBy: req.user._id, assignedAt: now,
      responseDueAt: new Date(now.getTime() + Number(hours) * 3600 * 1000),
      $unset: { lockedBy: 1, lockedUntil: 1 },
      $push: { history: { action: mode === 'assign' ? 'assigned' : 'reassigned', seller: seller._id, by: req.user._id, note, at: now } },
    },
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'RFQ changed while you were working on it. Refresh and try again.');
  seller.seller.leadsReceived = (seller.seller.leadsReceived || 0) + 1;
  await seller.save();

  await notify(seller._id, {
    type: 'lead_assigned', title: 'New exclusive lead for you',
    body: `${updated.number}: ${updated.title} (${updated.category}). Only you can quote — respond within ${hours} hours.`,
    link: `/seller/leads/${updated._id}`,
  });
  if (prevSeller) await notify(prevSeller, { type: 'lead_removed', title: 'Lead reassigned', body: `${updated.number} was reassigned because the response window passed.`, link: '/seller/leads', email: false });
  await notify(updated.buyer, { type: 'rfq_assigned', title: 'Your RFQ is with a verified seller', body: `${updated.number} has been matched. You'll be notified when the quote arrives.`, link: `/buyer/rfqs/${updated._id}`, email: mode === 'assign' });
  await audit(req, mode === 'assign' ? 'rfq.assign' : 'rfq.reassign', 'RFQ', updated._id, { number: updated.number, seller: seller.company || seller.name, sellerId: seller._id, prevSeller, hours, note });
  return updated;
}

r.post('/rfqs/:id/assign', ROUTING, ah(async (req, res) => res.json(await pushLead(req, 'assign'))));
r.post('/rfqs/:id/reassign', ROUTING, ah(async (req, res) => res.json(await pushLead(req, 'reassign'))));

r.post('/rfqs/:id/unassign', ROUTING, ah(async (req, res) => {
  const rfq = await RFQ.findOne({ _id: req.params.id, status: 'assigned' });
  if (!rfq) throw new HttpError(400, 'Only assigned (unquoted) RFQs can be pulled back.');
  const prev = rfq.assignedSeller;
  rfq.history.push({ action: 'unassigned', seller: prev, by: req.user._id, note: req.body.note });
  rfq.status = 'pending';
  rfq.assignedSeller = undefined;
  rfq.responseDueAt = undefined;
  await rfq.save();
  notify(prev, { type: 'lead_removed', title: 'Lead withdrawn', body: `${rfq.number} was withdrawn by Ranavista.`, link: '/seller/leads', email: false });
  await audit(req, 'rfq.unassign', 'RFQ', rfq._id, { number: rfq.number, prevSeller: prev });
  res.json(rfq);
}));

r.patch('/rfqs/:id', ALL, ah(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id);
  if (!rfq) throw new HttpError(404, 'RFQ not found.');
  if (req.body.adminNotes !== undefined) rfq.adminNotes = req.body.adminNotes;
  if (req.body.category) rfq.category = req.body.category;
  if (req.body.close) { rfq.status = 'closed'; rfq.history.push({ action: 'closed', by: req.user._id, note: req.body.note }); }
  await rfq.save();
  await audit(req, 'rfq.update', 'RFQ', rfq._id, req.body);
  res.json(rfq);
}));

/* ======================= SELLERS & BUYERS ======================= */
r.get('/users', ALL, ah(async (req, res) => {
  const q = { role: req.query.role === 'buyer' ? 'buyer' : 'seller' };
  if (req.query.approval) q['seller.approval'] = req.query.approval;
  if (req.query.status) q.status = req.query.status;
  if (req.query.category) q['seller.categories'] = req.query.category;
  if (req.query.q) q.$or = [{ name: rx(req.query.q) }, { email: rx(req.query.q) }, { company: rx(req.query.q) }];
  res.json(await User.find(q).sort('-createdAt').limit(500).lean().then((l) => l.map(({ password, otp, ...u }) => u)));
}));

r.get('/users/:id', ALL, ah(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found.');
  const key = user.role === 'seller' ? 'seller' : 'buyer';
  const [orders, rfqs, reviews, ledger] = await Promise.all([
    Order.find({ [key]: user._id }).sort('-createdAt').limit(50).populate('rfq', 'number').select('number total paymentStatus fulfillment createdAt sellerPayout platformFee'),
    RFQ.find(user.role === 'seller' ? { assignedSeller: user._id } : { buyer: user._id }).sort('-createdAt').limit(50).select('number title status category createdAt'),
    Review.find({ to: user._id }).populate('from', 'name company').sort('-createdAt').limit(20),
    Order.aggregate([{ $match: { [key]: user._id } }, { $group: { _id: '$paymentStatus', total: { $sum: user.role === 'seller' ? '$sellerPayout' : '$total' }, n: { $sum: 1 } } }]),
  ]);
  res.json({ user: user.toSafeJSON(), orders, rfqs, reviews, ledger });
}));

r.post('/users/:id/approval', adminRole('support', 'category'), ah(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'seller' });
  if (!u) throw new HttpError(404, 'Seller not found.');
  const { decision, reason } = req.body; // approved | rejected
  if (!['approved', 'rejected', 'pending'].includes(decision)) throw new HttpError(400, 'Invalid decision.');
  u.seller.approval = decision;
  u.seller.rejectionReason = decision === 'rejected' ? reason : undefined;
  await u.save();
  await notify(u._id, decision === 'approved'
    ? { type: 'seller_approved', title: 'Your seller account is approved ✓', body: 'You can now receive exclusive leads from US buyers. Connect payouts to get paid.', link: '/seller' }
    : { type: 'seller_rejected', title: 'Seller verification update', body: reason || 'We need more information to verify your business.', link: '/seller/profile' });
  await audit(req, `seller.${decision}`, 'User', u._id, { company: u.company, reason });
  res.json(u.toSafeJSON());
}));

r.post('/users/:id/status', adminRole('support'), ah(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u || u.role === 'admin') throw new HttpError(404, 'User not found.');
  u.status = req.body.status === 'suspended' ? 'suspended' : 'active';
  await u.save();
  await audit(req, `user.${u.status}`, 'User', u._id, { email: u.email, reason: req.body.reason });
  res.json(u.toSafeJSON());
}));

r.patch('/users/:id/categories', adminRole('category', 'support'), ah(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'seller' });
  if (!u) throw new HttpError(404, 'Seller not found.');
  u.seller.categories = req.body.categories || [];
  await u.save();
  await audit(req, 'seller.categories', 'User', u._id, { categories: u.seller.categories });
  res.json(u.toSafeJSON());
}));

/* ---------- Subscription management on a user ---------- */
r.post('/users/:id/subscription', FINANCE, ah(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u || u.role === 'admin') throw new HttpError(404, 'User not found.');
  if (req.body.action === 'cancel') {
    await cancelSubscription(u.subscription?.stripeSubscriptionId);
    u.subscription.status = 'canceled';
    u.subscription.plan = 'free';
  } else {
    const plan = await Plan.findOne({ key: req.body.planKey, audience: u.role });
    if (!plan) throw new HttpError(400, 'Plan does not match this user type.');
    u.subscription.plan = plan.key;
    u.subscription.status = 'active';
    u.subscription.assignedByAdmin = true;
    u.subscription.currentPeriodEnd = req.body.until ? new Date(req.body.until) : new Date(Date.now() + 30 * 864e5);
  }
  await u.save();
  await audit(req, `subscription.${req.body.action || 'assign'}`, 'User', u._id, req.body);
  notify(u._id, { type: 'billing', title: 'Your plan was updated', body: `Current plan: ${u.subscription.plan}`, link: `/${u.role}/subscription`, email: false });
  res.json(u.toSafeJSON());
}));

/* ======================= ORDERS / TRANSACTION CONTROL ======================= */
r.get('/orders', ALL, ah(async (req, res) => {
  const q = {};
  if (req.query.paymentStatus) q.paymentStatus = { $in: String(req.query.paymentStatus).split(',') };
  if (req.query.buyer) q.buyer = req.query.buyer;
  if (req.query.seller) q.seller = req.query.seller;
  if (req.query.q) q.number = rx(req.query.q);
  const list = await Order.find(q).sort('-createdAt').limit(500).populate('buyer', 'company name').populate('seller', 'company name').populate('rfq', 'number').lean();
  const totals = await Order.aggregate([{ $match: q }, { $group: { _id: '$paymentStatus', total: { $sum: '$total' }, fees: { $sum: '$platformFee' }, n: { $sum: 1 } } }]);
  res.json({ list, totals });
}));

/** Buyer / seller ledgers — per-party money summary. */
r.get('/ledgers/:role', FINANCE, ah(async (req, res) => {
  const role = req.params.role === 'seller' ? 'seller' : 'buyer';
  const amount = role === 'seller' ? '$sellerPayout' : '$total';
  const rows = await Order.aggregate([
    { $group: {
      _id: `$${role}`, orders: { $sum: 1 },
      paid: { $sum: { $cond: [{ $in: ['$paymentStatus', ['held', 'released', 'disputed', 'refunded', 'chargeback']] }, amount, 0] } },
      held: { $sum: { $cond: [{ $in: ['$paymentStatus', ['held', 'disputed']] }, amount, 0] } },
      released: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'released'] }, amount, 0] } },
      refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, amount, 0] } },
      fees: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'released'] }, '$platformFee', 0] } },
      last: { $max: '$createdAt' },
    } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $project: { orders: 1, paid: 1, held: 1, released: 1, refunded: 1, fees: 1, last: 1, name: '$u.name', company: '$u.company', email: '$u.email' } },
    { $sort: { paid: -1 } },
  ]);
  res.json(rows);
}));

r.get('/orders/:id', ALL, ah(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name company email phone').populate('seller', 'name company email seller.stripeAccountId seller.payoutsEnabled')
    .populate('rfq', 'number title').populate('ledger.by', 'name role');
  if (!order) throw new HttpError(404, 'Order not found.');
  const disputes = await Dispute.find({ order: order._id }).select('status reason createdAt');
  res.json({ order, disputes });
}));

r.post('/orders/:id/release', FINANCE, ah(async (req, res) => {
  const o = await releaseOrder(req.params.id, req.user._id, req.body.note || 'Manually released by admin');
  await audit(req, 'order.release', 'Order', o._id, { number: o.number, amount: o.sellerPayout, note: req.body.note });
  res.json(o);
}));

r.post('/orders/:id/refund', FINANCE, ah(async (req, res) => {
  const o = await refundOrder(req.params.id, req.user._id, req.body.amount, req.body.note || 'Manually refunded by admin');
  await audit(req, 'order.refund', 'Order', o._id, { number: o.number, amount: req.body.amount || 'full', note: req.body.note });
  res.json(o);
}));

r.post('/orders/:id/note', ALL, ah(async (req, res) => {
  const o = await Order.findById(req.params.id);
  o.ledger.push({ type: 'note', note: req.body.note, by: req.user._id });
  await o.save();
  res.json(o);
}));

r.get('/chargebacks', FINANCE, ah(async (req, res) => {
  res.json(await Order.find({ paymentStatus: 'chargeback' }).populate('buyer seller', 'company name').sort('-updatedAt'));
}));

/* ======================= DISPUTES ======================= */
r.get('/disputes', SUPPORT, ah(async (req, res) => {
  const q = req.query.status ? { status: { $in: String(req.query.status).split(',') } } : {};
  res.json(await Dispute.find(q).sort('-createdAt').populate({ path: 'order', select: 'number total paymentStatus', populate: { path: 'buyer seller', select: 'company name' } }).populate('openedBy', 'name role').populate('assignedTo', 'name').lean());
}));

r.get('/disputes/:id', SUPPORT, ah(async (req, res) => {
  const d = await Dispute.findById(req.params.id)
    .populate({ path: 'order', populate: [{ path: 'buyer', select: 'name company email' }, { path: 'seller', select: 'name company email' }, { path: 'rfq', select: 'number title' }] })
    .populate('openedBy', 'name role').populate('thread.by', 'name role').populate('assignedTo', 'name').populate('resolution.by', 'name');
  if (!d) throw new HttpError(404, 'Dispute not found.');
  const messages = await Message.find({ rfq: d.order.rfq._id }).sort('createdAt').populate('sender', 'name role').lean();
  res.json({ dispute: d, messages });
}));

r.post('/disputes/:id/message', SUPPORT, ah(async (req, res) => {
  const d = await Dispute.findById(req.params.id).populate('order', 'buyer seller number');
  d.thread.push({ by: req.user._id, role: 'admin', text: req.body.text, internal: !!req.body.internal });
  if (d.status === 'open') d.status = 'under_review';
  if (!d.assignedTo) d.assignedTo = req.user._id;
  await d.save();
  if (!req.body.internal) {
    [d.order.buyer, d.order.seller].forEach((u, i) =>
      notify(u, { type: 'dispute', title: `Update on dispute — ${d.order.number}`, body: req.body.text.slice(0, 140), link: `/${i === 0 ? 'buyer' : 'seller'}/orders/${d.order._id}` }));
  }
  res.json(d);
}));

r.post('/disputes/:id/resolve', FINANCE, ah(async (req, res) => {
  const d = await Dispute.findById(req.params.id);
  if (!['open', 'under_review'].includes(d.status)) throw new HttpError(400, 'Dispute already resolved.');
  const { outcome, amount, note } = req.body; // refund | release | partial
  if (outcome === 'refund') await refundOrder(d.order, req.user._id, null, `Dispute resolved: full refund. ${note || ''}`);
  else if (outcome === 'release') await releaseOrder(d.order, req.user._id, `Dispute resolved in seller's favor. ${note || ''}`);
  else if (outcome === 'partial') {
    if (!(Number(amount) > 0)) throw new HttpError(400, 'Enter the refund amount.');
    await refundOrder(d.order, req.user._id, amount, `Dispute resolved: partial refund. ${note || ''}`);
  } else throw new HttpError(400, 'Choose an outcome.');
  d.status = { refund: 'resolved_refund', release: 'resolved_release', partial: 'resolved_partial' }[outcome];
  d.resolution = { note, refundAmount: outcome === 'partial' ? amount : outcome === 'refund' ? undefined : 0, by: req.user._id, at: new Date() };
  await d.save();
  await audit(req, 'dispute.resolve', 'Dispute', d._id, { outcome, amount, note });
  res.json(d);
}));

/* ======================= PLANS & REVENUE ======================= */
r.get('/plans', ALL, ah(async (req, res) => {
  const plans = await Plan.find().sort('audience sort').lean();
  const counts = await User.aggregate([{ $match: { 'subscription.status': 'active' } }, { $group: { _id: '$subscription.plan', n: { $sum: 1 } } }]);
  res.json(plans.map((p) => ({ ...p, subscribers: counts.find((c) => c._id === p.key)?.n || 0 })));
}));

r.post('/plans', FINANCE, ah(async (req, res) => {
  const p = await Plan.create(req.body);
  await audit(req, 'plan.create', 'Plan', p._id, req.body);
  res.status(201).json(p);
}));

r.patch('/plans/:id', FINANCE, ah(async (req, res) => {
  const { _id, key, ...rest } = req.body;
  const p = await Plan.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });
  await audit(req, 'plan.update', 'Plan', p._id, rest);
  res.json(p);
}));

r.get('/revenue', FINANCE, ah(async (req, res) => {
  const now = new Date();
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [fees, byTier, churn30, newSubs30, byCategory] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'released', releasedAt: { $gte: yearAgo } } },
      { $group: { _id: { y: { $year: '$releasedAt' }, m: { $month: '$releasedAt' } }, fees: { $sum: '$platformFee' }, gmv: { $sum: '$total' } } },
    ]),
    User.aggregate([{ $match: { 'subscription.status': 'active' } }, { $group: { _id: '$subscription.plan', n: { $sum: 1 } } }]),
    User.countDocuments({ 'subscription.status': 'canceled', updatedAt: { $gte: new Date(Date.now() - 30 * 864e5) } }),
    User.countDocuments({ 'subscription.status': 'active', updatedAt: { $gte: new Date(Date.now() - 30 * 864e5) } }),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ['held', 'released'] } } },
      { $lookup: { from: 'rfqs', localField: 'rfq', foreignField: '_id', as: 'r' } }, { $unwind: '$r' },
      { $group: { _id: '$r.category', gmv: { $sum: '$total' }, n: { $sum: 1 } } }, { $sort: { gmv: -1 } },
    ]),
  ]);
  const plans = await Plan.find().lean();
  const tiers = plans.map((p) => {
    const n = byTier.find((t) => t._id === p.key)?.n || 0;
    return { key: p.key, name: p.name, audience: p.audience, subscribers: n, mrr: n * p.priceMonthly };
  });
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const f = fees.find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1);
    months.push({ label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), fees: f?.fees || 0, gmv: f?.gmv || 0 });
  }
  const mrr = tiers.reduce((s, t) => s + t.mrr, 0);
  const paying = tiers.reduce((s, t) => s + (t.mrr > 0 ? t.subscribers : 0), 0);
  res.json({ months, tiers, mrr, arr: mrr * 12, paying, churn30, newSubs30, churnRate: paying ? +((churn30 / (paying + churn30)) * 100).toFixed(1) : 0, byCategory });
}));

/* ======================= REVIEWS, ENQUIRIES ======================= */
r.get('/reviews', SUPPORT, ah(async (req, res) => res.json(await Review.find().sort('-createdAt').limit(200).populate('from to', 'name company role').populate('order', 'number'))));
r.post('/reviews/:id/hide', SUPPORT, ah(async (req, res) => {
  const rv = await Review.findByIdAndUpdate(req.params.id, { hidden: !!req.body.hidden }, { new: true });
  await audit(req, rv.hidden ? 'review.hide' : 'review.show', 'Review', rv._id);
  res.json(rv);
}));
r.get('/enquiries', SUPPORT, ah(async (req, res) => res.json(await Enquiry.find().sort('-createdAt').limit(200))));
r.post('/enquiries/:id/handled', SUPPORT, ah(async (req, res) => res.json(await Enquiry.findByIdAndUpdate(req.params.id, { handled: true }, { new: true }))));

/* ======================= AUDIT & TEAM (super admin) ======================= */
r.get('/audit', SUPER, ah(async (req, res) => {
  const q = {};
  if (req.query.action) q.action = rx(req.query.action);
  if (req.query.entityId) q.entityId = req.query.entityId;
  if (req.query.admin) q.admin = oid(req.query.admin);
  const page = Math.max(1, Number(req.query.page || 1));
  const [list, total] = await Promise.all([
    AuditLog.find(q).sort('-createdAt').skip((page - 1) * 50).limit(50).populate('admin', 'name adminRole').lean(),
    AuditLog.countDocuments(q),
  ]);
  res.json({ list, total, page, pages: Math.ceil(total / 50) });
}));

/** Assignment-specific trail for an RFQ is open to all admins. */
r.get('/audit/rfq/:id', ALL, ah(async (req, res) => res.json(await AuditLog.find({ entity: 'RFQ', entityId: req.params.id }).sort('-createdAt').populate('admin', 'name adminRole'))));

r.get('/team', SUPER, ah(async (req, res) => res.json(await User.find({ role: 'admin' }).sort('name').lean().then((l) => l.map(({ password, otp, ...u }) => u)))));

r.post('/team', SUPER, ah(async (req, res) => {
  const { name, email, password, adminRole: ar, adminCategories } = req.body;
  if (!['super', 'finance', 'support', 'category'].includes(ar)) throw new HttpError(400, 'Choose a role.');
  const u = await User.create({ name, email, password, role: 'admin', adminRole: ar, adminCategories, emailVerified: true });
  await audit(req, 'team.create', 'User', u._id, { email, adminRole: ar });
  res.status(201).json(u.toSafeJSON());
}));

r.patch('/team/:id', SUPER, ah(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'admin' });
  if (!u) throw new HttpError(404, 'Admin not found.');
  if (String(u._id) === String(req.user._id) && (req.body.status === 'suspended' || (req.body.adminRole && req.body.adminRole !== 'super')))
    throw new HttpError(400, "You can't demote or suspend yourself.");
  ['adminRole', 'adminCategories', 'status', 'name'].forEach((k) => req.body[k] !== undefined && (u[k] = req.body[k]));
  if (req.body.password) u.password = req.body.password;
  await u.save();
  await audit(req, 'team.update', 'User', u._id, { ...req.body, password: req.body.password ? '***' : undefined });
  res.json(u.toSafeJSON());
}));

export default r;

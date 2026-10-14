import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { Dispute, Review } from '../models/misc.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { createOrderCheckout, getCheckout } from '../services/stripe.js';
import { markOrderPaid, releaseOrder, attachInvoice } from '../services/orders.js';
import { notify, notifyAdmins } from '../services/notify.js';
import { UPLOAD_DIR } from '../middleware/upload.js';

const r = Router();
r.use(auth);

async function loadOrder(req) {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name company email phone address')
    .populate('seller', 'name company email seller.rating seller.ratingCount seller.country')
    .populate('rfq', 'number title category destination containerType');
  if (!order) throw new HttpError(404, 'Order not found.');
  const uid = String(req.user._id);
  if (req.user.role !== 'admin' && String(order.buyer._id) !== uid && String(order.seller._id) !== uid) throw new HttpError(404, 'Order not found.');
  return order;
}

r.get('/', ah(async (req, res) => {
  const q = req.user.role === 'seller' ? { seller: req.user._id } : { buyer: req.user._id };
  if (req.query.status) q.paymentStatus = req.query.status;
  const orders = await Order.find(q).sort('-createdAt').populate('rfq', 'number title').populate(req.user.role === 'seller' ? 'buyer' : 'seller', 'company name').lean();
  res.json(orders);
}));

r.get('/:id', ah(async (req, res) => {
  const order = await loadOrder(req);
  const dispute = await Dispute.findOne({ order: order._id }).sort('-createdAt').populate('thread.by', 'name role');
  const reviews = await Review.find({ order: order._id }).populate('from', 'name company');
  const o = order.toObject();
  if (req.user.role === 'buyer') { delete o.sellerPayout; delete o.platformFee; }
  if (dispute) dispute.thread = dispute.thread.filter((t) => !t.internal);
  res.json({ order: o, dispute, reviews });
}));

/* ---------- Pay (escrow hold) ---------- */
r.post('/:id/pay', allow('buyer'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus !== 'unpaid') throw new HttpError(400, 'This order is already paid.');
  const session = await createOrderCheckout(order, req.user);
  if (session.demo) {
    await markOrderPaid(order._id, session.id);
    return res.json({ demo: true, paid: true });
  }
  res.json({ url: session.url });
}));

/* Called when the buyer returns from Stripe Checkout (webhook also handles this). */
r.post('/:id/verify-payment', allow('buyer'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus !== 'unpaid') return res.json({ paid: true });
  const s = await getCheckout(req.body.sessionId);
  if (s && s.payment_status === 'paid' && s.metadata?.orderId === String(order._id)) {
    await markOrderPaid(order._id, s.payment_intent);
    return res.json({ paid: true });
  }
  res.json({ paid: false });
}));

/* ---------- Seller ships ---------- */
r.post('/:id/ship', allow('seller'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus !== 'held' || order.fulfillment !== 'processing') throw new HttpError(400, 'Order must be paid and in processing.');
  order.fulfillment = 'shipped';
  order.shippedAt = new Date();
  order.tracking = { carrier: req.body.carrier, number: req.body.number, note: req.body.note };
  await order.save();
  await notify(order.buyer._id, { type: 'order_shipped', title: 'Your order has shipped', body: `${order.number} shipped${req.body.carrier ? ` via ${req.body.carrier}` : ''}. Confirm delivery once it arrives to release payment.`, link: `/buyer/orders/${order._id}` });
  res.json(order);
}));

/* ---------- Buyer confirms delivery → release funds ---------- */
r.post('/:id/confirm-delivery', allow('buyer'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus !== 'held') throw new HttpError(400, 'Payment is not on hold for this order.');
  if (!['shipped', 'processing'].includes(order.fulfillment)) throw new HttpError(400, 'Order is not in transit.');
  order.fulfillment = 'delivered';
  order.deliveredAt = new Date();
  await order.save();
  try {
    await releaseOrder(order._id, req.user._id, 'Buyer confirmed delivery');
  } catch (e) {
    // e.g. seller hasn't finished Stripe onboarding — keep funds held and let finance release manually
    await Order.updateOne({ _id: order._id }, { $push: { ledger: { type: 'note', note: `Auto-release failed: ${e.message}` } } });
    await notifyAdmins({ type: 'release_failed', title: 'Release needs attention', body: `${order.number}: buyer confirmed delivery but payout failed (${e.message}).`, link: `/orders/${order._id}` }, ['finance']);
  }
  res.json({ ok: true });
}));

/* ---------- Invoice download (authenticated) ---------- */
r.get('/:id/invoice', ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus === 'unpaid') throw new HttpError(400, 'Invoice is issued after payment.');
  const rel = order.invoiceFile || (await attachInvoice(order._id));
  const full = path.join(UPLOAD_DIR, 'invoices', path.basename(rel));
  if (!fs.existsSync(full)) await attachInvoice(order._id);
  res.download(full, `Ranavista-Invoice-${order.number}.pdf`);
}));

/* ---------- Disputes ---------- */
r.post('/:id/dispute', allow('buyer', 'seller'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (order.paymentStatus !== 'held') throw new HttpError(400, 'Disputes can be opened only while funds are on hold.');
  if (await Dispute.exists({ order: order._id, status: { $in: ['open', 'under_review'] } })) throw new HttpError(400, 'A dispute is already open.');
  const d = await Dispute.create({
    order: order._id, openedBy: req.user._id, reason: req.body.reason, description: req.body.description,
    thread: [{ by: req.user._id, role: req.user.role, text: req.body.description }],
  });
  order.paymentStatus = 'disputed';
  order.ledger.push({ type: 'note', note: `Dispute opened by ${req.user.role}: ${req.body.reason}`, by: req.user._id });
  await order.save();
  const other = req.user.role === 'buyer' ? order.seller._id : order.buyer._id;
  await notify(other, { type: 'dispute', title: 'A dispute was opened', body: `${order.number}: funds are frozen while Ranavista reviews it.`, link: `/${req.user.role === 'buyer' ? 'seller' : 'buyer'}/orders/${order._id}` });
  await notifyAdmins({ type: 'dispute', title: 'New dispute', body: `${order.number} · ${req.body.reason}`, link: `/disputes/${d._id}` }, ['support', 'finance']);
  res.status(201).json(d);
}));

r.post('/:id/dispute/message', allow('buyer', 'seller'), ah(async (req, res) => {
  const order = await loadOrder(req);
  const d = await Dispute.findOne({ order: order._id, status: { $in: ['open', 'under_review'] } });
  if (!d) throw new HttpError(404, 'No open dispute.');
  d.thread.push({ by: req.user._id, role: req.user.role, text: req.body.text });
  await d.save();
  res.json(d);
}));

/* ---------- Reviews (two-way) ---------- */
r.post('/:id/review', allow('buyer', 'seller'), ah(async (req, res) => {
  const order = await loadOrder(req);
  if (!['released', 'refunded'].includes(order.paymentStatus) && order.fulfillment !== 'delivered') throw new HttpError(400, 'You can review after the order is completed.');
  const isBuyer = req.user.role === 'buyer';
  const rating = Math.max(1, Math.min(5, Number(req.body.rating)));
  const review = await Review.create({
    order: order._id, from: req.user._id, to: isBuyer ? order.seller._id : order.buyer._id, fromRole: req.user.role, rating, comment: req.body.comment,
  });
  await Order.updateOne({ _id: order._id }, isBuyer ? { reviewedByBuyer: true } : { reviewedBySeller: true });
  if (isBuyer) {
    const stats = await Review.aggregate([{ $match: { to: order.seller._id, fromRole: 'buyer', hidden: false } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
    await User.updateOne({ _id: order.seller._id }, { 'seller.rating': +(stats[0]?.avg || 0).toFixed(2), 'seller.ratingCount': stats[0]?.n || 0 });
  }
  await notify(review.to, { type: 'review', title: 'You received a new review', body: `${rating}★ on ${order.number}`, link: isBuyer ? '/seller/reviews' : `/buyer/orders/${order._id}`, email: false });
  res.status(201).json(review);
}));

export default r;

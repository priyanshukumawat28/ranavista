import { Router } from 'express';
import RFQ from '../models/RFQ.js';
import Quote, { calcTotal } from '../models/Quote.js';
import Order from '../models/Order.js';
import { auth, allow, verifiedOnly, approvedSeller } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { notify, notifyAdmins } from '../services/notify.js';
import { planFor } from '../utils/plans.js';
import { containerFill } from '../utils/container.js';
import env from '../config/env.js';

const r = Router();
r.use(auth);

const SELLER_SAFE_BUYER = 'name company address.state address.country'; // seller sees limited buyer info

async function loadRfqFor(req, id) {
  const rfq = await RFQ.findById(id)
    .populate('buyer', req.user.role === 'seller' ? SELLER_SAFE_BUYER : 'name company email phone address')
    .populate('assignedSeller', 'name company seller.rating seller.ratingCount seller.country');
  if (!rfq) throw new HttpError(404, 'RFQ not found.');
  const uid = String(req.user._id);
  const ok =
    req.user.role === 'admin' ||
    String(rfq.buyer._id) === uid ||
    (req.user.role === 'seller' && rfq.assignedSeller && String(rfq.assignedSeller._id) === uid);
  if (!ok) throw new HttpError(404, 'RFQ not found.');
  return rfq;
}

/* ---------- Container fill preview (used by cart) ---------- */
r.post('/container-fill', ah(async (req, res) => {
  res.json(containerFill(req.body.items || [], req.body.type || '40ft'));
}));

/* ---------- Buyer: post RFQ ---------- */
r.post('/', allow('buyer'), verifiedOnly, ah(async (req, res) => {
  const plan = await planFor(req.user);
  const limit = plan?.limits?.rfqsPerMonth ?? 3;
  if (limit !== -1) {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const used = await RFQ.countDocuments({ buyer: req.user._id, createdAt: { $gte: start } });
    if (used >= limit) throw new HttpError(402, `Your ${plan.name} plan allows ${limit} RFQs per month. Upgrade to post more.`, 'PLAN_LIMIT');
  }
  const { title, category, description, items, budget, deadline, incoterm, containerType, destination, attachments } = req.body;
  if (!deadline || new Date(deadline) < new Date()) throw new HttpError(400, 'Deadline must be in the future.');
  const rfq = await RFQ.create({
    buyer: req.user._id, title, category, description, items, budget, deadline, incoterm, containerType, destination, attachments,
    history: [{ action: 'created', by: req.user._id }],
  });
  await notifyAdmins({ type: 'rfq_new', title: 'New RFQ in queue', body: `${rfq.number} · ${rfq.title} (${rfq.category})`, link: `/rfqs/${rfq._id}` }, ['category', 'support']);
  res.status(201).json(rfq);
}));

/* ---------- List: buyer sees own, seller sees leads assigned to them ---------- */
r.get('/', ah(async (req, res) => {
  const q = {};
  if (req.user.role === 'buyer') q.buyer = req.user._id;
  else if (req.user.role === 'seller') q.assignedSeller = req.user._id;
  if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
  const rfqs = await RFQ.find(q)
    .sort('-createdAt')
    .limit(200)
    .populate('buyer', req.user.role === 'seller' ? SELLER_SAFE_BUYER : 'name company')
    .populate('assignedSeller', 'company name')
    .lean();
  // Buyers never see which seller is assigned until a quote arrives
  if (req.user.role === 'buyer') rfqs.forEach((x) => { if (['pending', 'assigned'].includes(x.status)) delete x.assignedSeller; });
  res.json(rfqs);
}));

r.get('/:id', ah(async (req, res) => {
  const rfq = await loadRfqFor(req, req.params.id);
  const qq = { rfq: rfq._id };
  if (req.user.role === 'seller') qq.seller = req.user._id;
  const quotes = await Quote.find(qq).sort('-createdAt').populate('seller', 'company name seller.rating seller.ratingCount seller.country');
  const order = await Order.findOne({ rfq: rfq._id }).select('number paymentStatus fulfillment total');
  const out = rfq.toObject();
  if (req.user.role === 'buyer' && ['pending', 'assigned'].includes(rfq.status)) delete out.assignedSeller;
  if (req.user.role !== 'admin') { delete out.history; delete out.adminNotes; delete out.lockedBy; delete out.lockedUntil; delete out.assignedBy; }
  res.json({ rfq: out, quotes, order, fill: rfq.containerType !== 'none' ? containerFill(rfq.items, rfq.containerType) : null });
}));

r.post('/:id/cancel', allow('buyer'), ah(async (req, res) => {
  const rfq = await loadRfqFor(req, req.params.id);
  if (['accepted', 'closed', 'cancelled'].includes(rfq.status)) throw new HttpError(400, 'This RFQ can no longer be cancelled.');
  rfq.status = 'cancelled';
  rfq.history.push({ action: 'cancelled', by: req.user._id });
  await rfq.save();
  if (rfq.assignedSeller) notify(rfq.assignedSeller._id, { type: 'rfq_cancelled', title: 'Lead cancelled by buyer', body: `${rfq.number} was cancelled.`, link: '/seller/leads' });
  res.json(rfq);
}));

/* ---------- Seller: decline a lead (goes back to admin queue) ---------- */
r.post('/:id/decline', allow('seller'), ah(async (req, res) => {
  const rfq = await loadRfqFor(req, req.params.id);
  if (rfq.status !== 'assigned') throw new HttpError(400, 'Only unquoted leads can be declined.');
  rfq.history.push({ action: 'unassigned', seller: req.user._id, by: req.user._id, note: `Seller declined: ${req.body.reason || 'no reason'}` });
  rfq.status = 'pending';
  rfq.assignedSeller = undefined;
  rfq.assignedAt = undefined;
  rfq.responseDueAt = undefined;
  await rfq.save();
  await notifyAdmins({ type: 'lead_declined', title: 'Seller declined a lead', body: `${req.user.company || req.user.name} declined ${rfq.number}. Please reassign.`, link: `/rfqs/${rfq._id}` });
  res.json({ ok: true });
}));

/* ---------- Seller: submit quote ---------- */
r.post('/:id/quote', allow('seller'), approvedSeller, ah(async (req, res) => {
  const rfq = await loadRfqFor(req, req.params.id);
  if (rfq.status !== 'assigned') throw new HttpError(400, 'This lead is not open for quoting.');
  const { lines = [], shippingCost = 0, leadTimeDays, validUntil, incoterm, paymentTerms, notes } = req.body;
  const priced = rfq.items.map((it) => {
    const l = lines.find((x) => String(x.itemId) === String(it._id)) || {};
    if (!(Number(l.unitPrice) > 0)) throw new HttpError(400, `Enter a unit price for "${it.name}".`);
    return {
      itemId: it._id, name: it.name, unit: it.unit, quantity: Number(l.quantity || it.quantity), unitPrice: Number(l.unitPrice),
      cbmPerUnit: l.cbmPerUnit ?? it.cbmPerUnit, weightKgPerUnit: l.weightKgPerUnit ?? it.weightKgPerUnit,
    };
  });
  const total = calcTotal(priced, shippingCost);
  const quote = await Quote.create({
    rfq: rfq._id, seller: req.user._id, buyer: rfq.buyer._id, lines: priced, shippingCost, total, leadTimeDays, validUntil,
    incoterm: incoterm || rfq.incoterm, paymentTerms, notes,
    rounds: [{ by: 'seller', lines: priced, total, message: notes }],
  });
  rfq.status = 'quoted';
  rfq.history.push({ action: 'quoted', seller: req.user._id, by: req.user._id });
  await rfq.save();
  req.user.seller.leadsQuoted = (req.user.seller.leadsQuoted || 0) + 1;
  await req.user.save();
  await notify(rfq.buyer._id, { type: 'quote_received', title: 'You received a quotation', body: `A verified seller quoted $${total.toLocaleString('en-US')} for ${rfq.title}.`, link: `/buyer/rfqs/${rfq._id}` });
  res.status(201).json(quote);
}));

/* ---------- Negotiation ---------- */
async function loadQuote(req) {
  const quote = await Quote.findById(req.params.quoteId).populate('rfq');
  if (!quote) throw new HttpError(404, 'Quote not found.');
  const uid = String(req.user._id);
  if (String(quote.buyer) !== uid && String(quote.seller) !== uid) throw new HttpError(404, 'Quote not found.');
  return quote;
}

r.post('/quotes/:quoteId/counter', allow('buyer'), ah(async (req, res) => {
  const quote = await loadQuote(req);
  if (!['submitted', 'revised'].includes(quote.status)) throw new HttpError(400, 'Wait for the seller to respond first.');
  const lines = quote.lines.map((l) => {
    const c = (req.body.lines || []).find((x) => String(x.itemId) === String(l.itemId));
    return { ...l.toObject(), unitPrice: c ? Number(c.unitPrice) : l.unitPrice, quantity: c?.quantity ? Number(c.quantity) : l.quantity };
  });
  const total = calcTotal(lines, quote.shippingCost);
  quote.rounds.push({ by: 'buyer', lines, total, message: req.body.message });
  quote.status = 'countered';
  await quote.save();
  await RFQ.updateOne({ _id: quote.rfq._id }, { status: 'negotiating' });
  await notify(quote.seller, { type: 'quote_countered', title: 'Buyer sent a counter-offer', body: `Counter of $${total.toLocaleString('en-US')} on ${quote.rfq.number}.`, link: `/seller/leads/${quote.rfq._id}` });
  res.json(quote);
}));

r.post('/quotes/:quoteId/revise', allow('seller'), ah(async (req, res) => {
  const quote = await loadQuote(req);
  if (quote.status !== 'countered') throw new HttpError(400, 'Nothing to respond to yet.');
  const lines = quote.lines.map((l) => {
    const c = (req.body.lines || []).find((x) => String(x.itemId) === String(l.itemId));
    return { ...l.toObject(), unitPrice: c ? Number(c.unitPrice) : l.unitPrice, quantity: c?.quantity ? Number(c.quantity) : l.quantity };
  });
  if (req.body.shippingCost !== undefined) quote.shippingCost = Number(req.body.shippingCost);
  if (req.body.leadTimeDays) quote.leadTimeDays = req.body.leadTimeDays;
  quote.lines = lines;
  quote.total = calcTotal(lines, quote.shippingCost);
  quote.rounds.push({ by: 'seller', lines, total: quote.total, message: req.body.message });
  quote.status = 'revised';
  await quote.save();
  await notify(quote.buyer, { type: 'quote_revised', title: 'Seller revised the quotation', body: `New total $${quote.total.toLocaleString('en-US')} for ${quote.rfq.number}.`, link: `/buyer/rfqs/${quote.rfq._id}` });
  res.json(quote);
}));

r.post('/quotes/:quoteId/accept', allow('buyer'), ah(async (req, res) => {
  const quote = await loadQuote(req);
  if (!['submitted', 'revised'].includes(quote.status)) throw new HttpError(400, 'This quote cannot be accepted right now.');
  if (quote.validUntil && quote.validUntil < new Date()) throw new HttpError(400, 'This quote has expired. Ask the seller to revise it.');
  quote.status = 'accepted';
  await quote.save();
  const subtotal = calcTotal(quote.lines, 0);
  const platformFee = Math.round(quote.total * env.platformFeePercent) / 100;
  const order = await Order.create({
    rfq: quote.rfq._id, quote: quote._id, buyer: quote.buyer, seller: quote.seller,
    lines: quote.lines.map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, cbmPerUnit: l.cbmPerUnit, weightKgPerUnit: l.weightKgPerUnit })),
    shippingCost: quote.shippingCost, subtotal, total: quote.total, platformFee, sellerPayout: +(quote.total - platformFee).toFixed(2),
  });
  await RFQ.updateOne({ _id: quote.rfq._id }, { status: 'accepted', $push: { history: { action: 'accepted', by: req.user._id } } });
  await notify(quote.seller, { type: 'quote_accepted', title: 'Your quote was accepted 🎉', body: `Order ${order.number} created. You'll be notified once payment is secured.`, link: `/seller/orders/${order._id}` });
  await notifyAdmins({ type: 'order_created', title: 'New order created', body: `${order.number} · $${order.total.toLocaleString('en-US')}`, link: `/orders/${order._id}` }, ['finance']);
  res.json({ quote, order });
}));

r.post('/quotes/:quoteId/reject', allow('buyer'), ah(async (req, res) => {
  const quote = await loadQuote(req);
  if (['accepted', 'rejected'].includes(quote.status)) throw new HttpError(400, 'Already closed.');
  quote.status = 'rejected';
  await quote.save();
  const wantsAnother = req.body.requestAnotherSeller !== false;
  await RFQ.updateOne(
    { _id: quote.rfq._id },
    {
      status: wantsAnother ? 'pending' : 'closed',
      $unset: wantsAnother ? { assignedSeller: 1, assignedAt: 1, responseDueAt: 1 } : {},
      $push: { history: { action: wantsAnother ? 'unassigned' : 'closed', seller: quote.seller, by: req.user._id, note: `Buyer rejected quote: ${req.body.reason || ''}` } },
    }
  );
  await notify(quote.seller, { type: 'quote_rejected', title: 'Quote not accepted', body: `The buyer passed on your quote for ${quote.rfq.number}.`, link: '/seller/leads' });
  if (wantsAnother) await notifyAdmins({ type: 'rfq_requeue', title: 'RFQ back in queue', body: `Buyer rejected the quote on ${quote.rfq.number} and wants another seller.`, link: `/rfqs/${quote.rfq._id}` });
  res.json({ ok: true });
}));

export default r;

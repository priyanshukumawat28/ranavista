import Order from '../models/Order.js';
import User from '../models/User.js';
import { generateInvoice } from './invoice.js';
import { releaseToSeller, refundPayment } from './stripe.js';
import { notify, notifyAdmins } from './notify.js';

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** Mark an order paid → funds are now HELD by the platform. Idempotent. */
export async function markOrderPaid(orderId, paymentIntentId) {
  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus !== 'unpaid') return order;
  order.paymentStatus = 'held';
  order.fulfillment = 'processing';
  order.stripePaymentIntentId = paymentIntentId;
  order.paidAt = new Date();
  order.ledger.push({ type: 'charge', amount: order.total, ref: paymentIntentId, note: 'Buyer payment received' });
  order.ledger.push({ type: 'hold', amount: order.total, note: 'Held until delivery is confirmed' });
  await order.save();
  await attachInvoice(order._id);
  await notify(order.seller, { type: 'order_paid', title: 'Payment secured — start production', body: `${order.number}: ${money(order.total)} is held safely. Ship the goods and mark the order as shipped.`, link: `/seller/orders/${order._id}` });
  await notify(order.buyer, { type: 'order_paid', title: 'Payment received', body: `Your payment for ${order.number} is held securely until you confirm delivery.`, link: `/buyer/orders/${order._id}`, email: true });
  return order;
}

export async function attachInvoice(orderId) {
  const order = await Order.findById(orderId).populate('buyer seller').populate('rfq', 'number');
  order.invoiceFile = await generateInvoice(order);
  await Order.updateOne({ _id: order._id }, { invoiceFile: order.invoiceFile });
  return order.invoiceFile;
}

/** Release held funds to the seller (buyer confirmed delivery or admin decision). */
export async function releaseOrder(orderId, by, note = 'Released to seller') {
  const order = await Order.findById(orderId);
  if (!['held', 'disputed'].includes(order.paymentStatus)) throw Object.assign(new Error('Funds are not on hold for this order.'), { status: 400 });
  const seller = await User.findById(order.seller);
  const tr = await releaseToSeller(order, seller);
  order.paymentStatus = 'released';
  order.releasedAt = new Date();
  order.stripeTransferId = tr.id;
  order.ledger.push({ type: 'fee', amount: order.platformFee, note: 'Platform fee retained', by });
  order.ledger.push({ type: 'release', amount: order.sellerPayout, ref: tr.id, note, by });
  await order.save();
  await notify(order.seller, { type: 'funds_released', title: 'Funds released 💰', body: `${money(order.sellerPayout)} for ${order.number} is on its way to your payout account.`, link: `/seller/orders/${order._id}` });
  return order;
}

export async function refundOrder(orderId, by, amount, note = 'Refunded to buyer') {
  const order = await Order.findById(orderId);
  if (!['held', 'disputed'].includes(order.paymentStatus)) throw Object.assign(new Error('Only held funds can be refunded.'), { status: 400 });
  const amt = amount ? Math.min(Number(amount), order.total) : order.total;
  const re = await refundPayment(order, amt);
  order.ledger.push({ type: 'refund', amount: amt, ref: re.id, note, by });
  if (amt >= order.total) {
    order.paymentStatus = 'refunded';
    order.fulfillment = 'cancelled';
    order.refundedAt = new Date();
  } else {
    // Partial refund: remainder released to seller (minus fee on the remainder)
    const remainder = +(order.total - amt).toFixed(2);
    order.platformFee = +(order.platformFee * (remainder / order.total)).toFixed(2);
    order.sellerPayout = +(remainder - order.platformFee).toFixed(2);
    await order.save();
    return releaseOrder(order._id, by, `Partial release after ${money(amt)} refund`);
  }
  await order.save();
  await notify(order.buyer, { type: 'refund', title: 'Refund issued', body: `${money(amt)} was refunded for ${order.number}. It may take 5–10 business days to appear.`, link: `/buyer/orders/${order._id}` });
  await notify(order.seller, { type: 'refund', title: 'Order refunded', body: `${order.number} was refunded to the buyer.`, link: `/seller/orders/${order._id}`, email: false });
  return order;
}

export { notifyAdmins };

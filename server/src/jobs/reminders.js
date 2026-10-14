import cron from 'node-cron';
import RFQ from '../models/RFQ.js';
import Order from '../models/Order.js';
import { Notification } from '../models/misc.js';
import { notify, notifyAdmins } from '../services/notify.js';

/** Don't send the same reminder twice within `hours`. */
async function once(userId, type, link, hours = 24) {
  return !(await Notification.exists({ user: userId, type, link, createdAt: { $gt: new Date(Date.now() - hours * 3600e3) } }));
}

export async function runReminders() {
  const now = new Date();
  const in12h = new Date(now.getTime() + 12 * 3600e3);
  const in48h = new Date(now.getTime() + 48 * 3600e3);

  // 1. Seller response window closing soon
  for (const rfq of await RFQ.find({ status: 'assigned', responseDueAt: { $gt: now, $lt: in12h } }).select('number assignedSeller responseDueAt')) {
    const link = `/seller/leads/${rfq._id}`;
    if (await once(rfq.assignedSeller, 'reminder_quote_due', link)) {
      await notify(rfq.assignedSeller, { type: 'reminder_quote_due', title: 'Quote due soon ⏰', body: `${rfq.number}: send your quotation before the lead is reassigned.`, link });
    }
  }

  // 2. Response window missed → flag for admin reassignment
  for (const rfq of await RFQ.find({ status: 'assigned', responseDueAt: { $lt: now } }).select('number')) {
    const link = `/rfqs/${rfq._id}`;
    await notifyAdmins({ type: 'lead_overdue', title: 'Seller missed response window', body: `${rfq.number} needs reassignment.`, link });
  }

  // 3. Buyer RFQ deadline approaching with a quote waiting
  for (const rfq of await RFQ.find({ status: { $in: ['quoted', 'negotiating'] }, deadline: { $gt: now, $lt: in48h } }).select('number buyer')) {
    const link = `/buyer/rfqs/${rfq._id}`;
    if (await once(rfq.buyer, 'reminder_deadline', link)) {
      await notify(rfq.buyer, { type: 'reminder_deadline', title: 'Your RFQ deadline is approaching', body: `${rfq.number} has a quote waiting for your decision.`, link });
    }
  }

  // 4. Accepted but unpaid orders (after 3 days)
  for (const o of await Order.find({ paymentStatus: 'unpaid', createdAt: { $lt: new Date(now.getTime() - 72 * 3600e3) } }).select('number buyer')) {
    const link = `/buyer/orders/${o._id}`;
    if (await once(o.buyer, 'reminder_payment', link, 72)) {
      await notify(o.buyer, { type: 'reminder_payment', title: 'Complete payment to start production', body: `${o.number} is waiting for payment.`, link });
    }
  }

  // 5. Shipped > 21 days, buyer hasn't confirmed delivery
  for (const o of await Order.find({ paymentStatus: 'held', fulfillment: 'shipped', shippedAt: { $lt: new Date(now.getTime() - 21 * 864e5) } }).select('number buyer')) {
    const link = `/buyer/orders/${o._id}`;
    if (await once(o.buyer, 'reminder_delivery', link, 72)) {
      await notify(o.buyer, { type: 'reminder_delivery', title: 'Has your order arrived?', body: `Confirm delivery of ${o.number} or open a dispute if something is wrong.`, link });
    }
  }
}

export function startJobs() {
  cron.schedule('0 * * * *', () => runReminders().catch((e) => console.error('reminder job failed', e)));
  console.log('✓ Reminder jobs scheduled (hourly)');
}

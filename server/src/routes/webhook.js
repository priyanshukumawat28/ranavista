import express, { Router } from 'express';
import env from '../config/env.js';
import { stripe } from '../services/stripe.js';
import { markOrderPaid } from '../services/orders.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { notifyAdmins, notify } from '../services/notify.js';

/*
 * Stripe webhook — mount BEFORE express.json() (needs the raw body).
 * Events to enable in the Stripe dashboard:
 *   checkout.session.completed, customer.subscription.created/updated/deleted,
 *   invoice.payment_failed, charge.dispute.created, account.updated
 */
const r = Router();

r.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.json({ ignored: true });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], env.stripeWebhookSecret);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    const o = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (o.metadata?.kind === 'order' && o.payment_status === 'paid') await markOrderPaid(o.metadata.orderId, o.payment_intent);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const user = await User.findById(o.metadata?.userId);
        if (!user) break;
        const status = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled' }[o.status] || 'none';
        user.subscription.plan = event.type.endsWith('deleted') ? 'free' : o.metadata.planKey || user.subscription.plan;
        user.subscription.status = event.type.endsWith('deleted') ? 'canceled' : status;
        user.subscription.stripeSubscriptionId = o.id;
        user.subscription.currentPeriodEnd = o.current_period_end ? new Date(o.current_period_end * 1000) : undefined;
        user.subscription.assignedByAdmin = false;
        await user.save();
        break;
      }

      case 'invoice.payment_failed': {
        const user = await User.findOne({ 'subscription.stripeCustomerId': o.customer });
        if (user) await notify(user._id, { type: 'billing', title: 'Subscription payment failed', body: 'Please update your card to keep your plan active.', link: `/${user.role}/subscription` });
        break;
      }

      case 'charge.dispute.created': {
        const order = await Order.findOne({ stripePaymentIntentId: o.payment_intent });
        if (order) {
          order.paymentStatus = 'chargeback';
          order.ledger.push({ type: 'chargeback', amount: o.amount / 100, ref: o.id, note: `Card chargeback: ${o.reason}` });
          await order.save();
          await notifyAdmins({ type: 'chargeback', title: 'Chargeback received', body: `${order.number} — respond in Stripe before the deadline.`, link: `/orders/${order._id}` }, ['finance']);
        }
        break;
      }

      case 'account.updated':
        await User.updateOne({ 'seller.stripeAccountId': o.id }, { 'seller.payoutsEnabled': !!o.payouts_enabled });
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('webhook handler error', e);
  }
  res.json({ received: true });
});

export default r;

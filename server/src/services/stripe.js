import Stripe from 'stripe';
import crypto from 'crypto';
import env from '../config/env.js';

/*
 * Escrow-style flow with Stripe Connect ("separate charges and transfers"):
 *   1. Buyer pays → PaymentIntent on the PLATFORM account. Money sits in the platform balance  = HELD
 *   2. Buyer confirms delivery (or admin releases) → Transfer (total − platform fee) to seller's
 *      connected Express account                                                              = RELEASED
 *   3. Dispute lost / cancelled → Refund the PaymentIntent (full or partial)                     = REFUNDED
 *
 * When STRIPE_SECRET_KEY is empty the app runs in DEMO mode: every call below returns a fake id
 * so the whole flow can be tested end-to-end without Stripe.
 */
export const stripe = env.stripeKey ? new Stripe(env.stripeKey) : null;
const fake = (p) => `${p}_demo_${crypto.randomBytes(8).toString('hex')}`;
const cents = (n) => Math.round(Number(n) * 100);

/* ---------------- Seller onboarding (Connect Express) ---------------- */
const COUNTRY_CODES = { 'United States': 'US', India: 'IN', Vietnam: 'VN', China: 'CN', Turkey: 'TR', Mexico: 'MX', Canada: 'CA', 'United Kingdom': 'GB' };

export async function createSellerAccount(user) {
  if (!stripe) return { id: fake('acct'), demo: true };
  const account = await stripe.accounts.create({
    type: 'express',
    country: COUNTRY_CODES[user.seller?.country] || 'US',
    email: user.email,
    business_profile: { name: user.company, url: user.seller?.website || undefined },
    capabilities: { transfers: { requested: true } },
    metadata: { userId: String(user._id) },
  });
  return account;
}

export async function onboardingLink(accountId) {
  if (!stripe) return `${env.clientUrl}/seller/payouts?demo_onboarded=1`;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${env.clientUrl}/seller/payouts?refresh=1`,
    return_url: `${env.clientUrl}/seller/payouts?done=1`,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function accountStatus(accountId) {
  if (!stripe) return { payoutsEnabled: true, detailsSubmitted: true };
  const a = await stripe.accounts.retrieve(accountId);
  return { payoutsEnabled: a.payouts_enabled && a.charges_enabled !== false, detailsSubmitted: a.details_submitted };
}

export async function dashboardLink(accountId) {
  if (!stripe) return null;
  const l = await stripe.accounts.createLoginLink(accountId);
  return l.url;
}

/* ---------------- Order payments ---------------- */
/** Stripe-hosted Checkout page (cards, ACH, Apple Pay, Google Pay) — no card data touches our server. */
export async function createOrderCheckout(order, buyer) {
  if (!stripe) return { id: fake('cs'), url: null, demo: true };
  const customer = await ensureCustomer(buyer);
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents(order.total),
          product_data: { name: `Order ${order.number}`, description: order.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ').slice(0, 450) },
        },
      },
    ],
    payment_intent_data: { transfer_group: order.number, metadata: { orderId: String(order._id) } },
    metadata: { orderId: String(order._id), kind: 'order' },
    success_url: `${env.clientUrl}/buyer/orders/${order._id}?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/buyer/orders/${order._id}?canceled=1`,
  });
}

export async function getCheckout(sessionId) {
  if (!stripe) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function releaseToSeller(order, seller) {
  if (!stripe || order.stripePaymentIntentId?.includes('_demo_')) return { id: fake('tr'), demo: true };
  if (!seller.seller?.stripeAccountId) throw Object.assign(new Error('Seller has not connected a payout account yet.'), { status: 400 });
  const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
  return stripe.transfers.create({
    amount: cents(order.sellerPayout),
    currency: 'usd',
    destination: seller.seller.stripeAccountId,
    transfer_group: order.number,
    source_transaction: pi.latest_charge || undefined,
    metadata: { orderId: String(order._id) },
  });
}

export async function refundPayment(order, amount) {
  if (!stripe || order.stripePaymentIntentId?.includes('_demo_')) return { id: fake('re'), demo: true };
  return stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amount ? cents(amount) : undefined,
    metadata: { orderId: String(order._id) },
  });
}

/* ---------------- Subscriptions (Stripe Billing) ---------------- */
export async function ensureCustomer(user) {
  if (!stripe) return fake('cus');
  if (user.subscription?.stripeCustomerId) return user.subscription.stripeCustomerId;
  const c = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(user._id), role: user.role } });
  user.subscription = { ...(user.subscription?.toObject?.() || user.subscription || {}), stripeCustomerId: c.id };
  await user.save();
  return c.id;
}

export async function subscriptionCheckout(user, plan, interval = 'month') {
  if (!stripe) return { url: null, demo: true };
  if (!plan.stripePriceId) throw Object.assign(new Error('This plan is not connected to Stripe yet. Admin: add a Stripe Price ID in Plans.'), { status: 400 });
  const customer = await ensureCustomer(user);
  const base = env.clientUrl + (user.role === 'seller' ? '/seller' : '/buyer');
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${base}/subscription?success=1`,
    cancel_url: `${base}/subscription?canceled=1`,
    metadata: { userId: String(user._id), planKey: plan.key, interval },
    subscription_data: { metadata: { userId: String(user._id), planKey: plan.key } },
    allow_promotion_codes: true,
  });
  return session;
}

export async function billingPortal(user) {
  if (!stripe || !user.subscription?.stripeCustomerId) return null;
  const base = env.clientUrl + (user.role === 'seller' ? '/seller' : '/buyer');
  const s = await stripe.billingPortal.sessions.create({ customer: user.subscription.stripeCustomerId, return_url: `${base}/subscription` });
  return s.url;
}

export async function cancelSubscription(subId) {
  if (!stripe || !subId || subId.includes('_demo_')) return;
  await stripe.subscriptions.cancel(subId);
}

import { Plan } from '../models/misc.js';

export const DEFAULT_PLANS = [
  {
    key: 'buyer_basic', audience: 'buyer', name: 'Basic', tagline: 'Try sourcing with Ranavista', priceMonthly: 0, priceYearly: 0, sort: 1,
    features: ['3 RFQs per month', 'Vetted seller matching', 'Secure escrow payments', 'In-app chat with your seller', 'Container fill planner'],
    limits: { rfqsPerMonth: 3, categories: 0, priority: 0 },
  },
  {
    key: 'buyer_growth', audience: 'buyer', name: 'Growth', tagline: 'For growing retailers & brands', priceMonthly: 49, priceYearly: 490, sort: 2, highlighted: true,
    features: ['25 RFQs per month', 'Priority admin review (within 24h)', 'Negotiation rounds', 'Invoice & order history export', 'Email + SMS alerts'],
    limits: { rfqsPerMonth: 25, categories: 0, priority: 1 },
  },
  {
    key: 'buyer_enterprise', audience: 'buyer', name: 'Enterprise', tagline: 'Dedicated sourcing desk', priceMonthly: 199, priceYearly: 1990, sort: 3,
    features: ['Unlimited RFQs', 'Dedicated sourcing manager', 'Same-day lead routing', 'Factory audit coordination', 'Custom payment terms'],
    limits: { rfqsPerMonth: -1, categories: 0, priority: 2 },
  },
  {
    key: 'seller_starter', audience: 'seller', name: 'Starter', tagline: 'Get verified and receive leads', priceMonthly: 0, priceYearly: 0, sort: 1,
    features: ['Verified seller badge', 'Up to 2 product categories', 'Standard lead priority', 'Escrow-protected payouts'],
    limits: { rfqsPerMonth: 0, categories: 2, priority: 0 },
  },
  {
    key: 'seller_pro', audience: 'seller', name: 'Professional', tagline: 'More categories, more leads', priceMonthly: 79, priceYearly: 790, sort: 2, highlighted: true,
    features: ['Up to 6 categories', 'Higher priority in lead assignment', 'Profile spotlight for US buyers', 'Performance analytics'],
    limits: { rfqsPerMonth: 0, categories: 6, priority: 1 },
  },
  {
    key: 'seller_enterprise', audience: 'seller', name: 'Enterprise', tagline: 'Top of the assignment list', priceMonthly: 249, priceYearly: 2490, sort: 3,
    features: ['Unlimited categories', 'Top priority in lead assignment', 'Dedicated account manager', 'Trade-fair promotion'],
    limits: { rfqsPerMonth: 0, categories: -1, priority: 2 },
  },
];

export async function ensurePlans() {
  for (const p of DEFAULT_PLANS) {
    await Plan.updateOne({ key: p.key }, { $setOnInsert: p }, { upsert: true });
  }
}

/** Active plan for a user (falls back to the free tier for their role). */
export async function planFor(user) {
  const freeKey = user.role === 'seller' ? 'seller_starter' : 'buyer_basic';
  const key = user.subscription?.status === 'active' ? user.subscription.plan : freeKey;
  return (await Plan.findOne({ key })) || (await Plan.findOne({ key: freeKey }));
}

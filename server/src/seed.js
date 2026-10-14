/*
 * npm run seed            → creates plans + the first Super Admin (from .env)
 * npm run seed -- --demo  → also creates demo buyer, sellers and RFQs to click through
 */
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import RFQ from './models/RFQ.js';
import { ensurePlans } from './utils/plans.js';

const demo = process.argv.includes('--demo');

async function upsertUser(data) {
  let u = await User.findOne({ email: data.email });
  if (!u) u = await User.create(data);
  return u;
}

await connectDB();
await ensurePlans();
console.log('✓ Plans ready');

const admin = await upsertUser({
  name: 'Super Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@ranavista.com',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  role: 'admin',
  adminRole: 'super',
  emailVerified: true,
});
console.log(`✓ Super admin: ${admin.email}`);

if (demo) {
  const pw = 'Demo@12345';
  const buyer = await upsertUser({
    name: 'Emily Carter', email: 'buyer@demo.com', password: pw, role: 'buyer', emailVerified: true,
    company: 'Hearth & Home Co.', phone: '+1 512 555 0142',
    address: { line1: '1200 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', country: 'United States' },
  });
  const sellers = [
    { name: 'Rohit Mehta', email: 'seller1@demo.com', company: 'Jaipur Textile House', country: 'India', categories: ['Home Textiles', 'Rugs & Carpets'], rating: 4.8, ratingCount: 31, plan: 'seller_enterprise' },
    { name: 'Anh Nguyen', email: 'seller2@demo.com', company: 'Saigon Rattan Works', country: 'Vietnam', categories: ['Furniture', 'Home Decor'], rating: 4.6, ratingCount: 18, plan: 'seller_pro' },
    { name: 'Priya Sharma', email: 'seller3@demo.com', company: 'Moradabad Brass Studio', country: 'India', categories: ['Home Decor', 'Kitchen & Dining', 'Lighting'], rating: 4.4, ratingCount: 9, plan: 'free' },
  ];
  for (const s of sellers) {
    await upsertUser({
      name: s.name, email: s.email, password: pw, role: 'seller', emailVerified: true, company: s.company,
      seller: { approval: 'approved', categories: s.categories, country: s.country, rating: s.rating, ratingCount: s.ratingCount, description: `${s.company} — export-ready manufacturer.`, payoutsEnabled: false },
      subscription: s.plan === 'free' ? {} : { plan: s.plan, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    });
  }
  await upsertUser({
    name: 'Kemal Aydin', email: 'seller4@demo.com', password: pw, role: 'seller', emailVerified: true, company: 'Denizli Towel Mills',
    seller: { approval: 'pending', categories: ['Home Textiles', 'Bath & Spa'], country: 'Turkey' },
  });

  if (!(await RFQ.exists({ buyer: buyer._id }))) {
    const soon = (d) => new Date(Date.now() + d * 864e5);
    for (const doc of [
      {
        buyer: buyer._id, title: 'Hand-block printed cotton table linens', category: 'Home Textiles', deadline: soon(21), containerType: '20ft', incoterm: 'FOB',
        description: 'Spring collection, 4 colorways. OEKO-TEX preferred. Private label packaging.',
        destination: { city: 'Austin', state: 'TX', zip: '78701', country: 'United States' }, budget: 42000,
        items: [
          { name: 'Table runner 14×72 in', quantity: 3000, unit: 'pcs', targetUnitPrice: 4.2, cbmPerUnit: 0.0015, weightKgPerUnit: 0.25 },
          { name: 'Napkin set of 4', quantity: 5000, unit: 'sets', targetUnitPrice: 3.1, cbmPerUnit: 0.0012, weightKgPerUnit: 0.2 },
        ],
        history: [{ action: 'created', by: buyer._id }],
      },
      {
        buyer: buyer._id, title: 'Rattan accent chairs', category: 'Furniture', deadline: soon(30), containerType: '40ft_hc', incoterm: 'FOB',
        description: 'Natural finish, KD (knock-down) preferred for container efficiency.',
        destination: { city: 'Austin', state: 'TX', zip: '78701', country: 'United States' }, budget: 60000,
        items: [{ name: 'Rattan accent chair', quantity: 400, unit: 'pcs', targetUnitPrice: 85, cbmPerUnit: 0.14, weightKgPerUnit: 9 }],
        history: [{ action: 'created', by: buyer._id }],
      },
    ]) await RFQ.create(doc);
  }
  console.log('✓ Demo data: buyer@demo.com / seller1..4@demo.com  (password Demo@12345)');
}

await mongoose.disconnect();
console.log('Done.');

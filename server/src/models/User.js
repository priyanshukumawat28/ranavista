import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String,
    country: { type: String, default: 'United States' },
  },
  { _id: false }
);

const sellerSchema = new mongoose.Schema(
  {
    approval: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectionReason: String,
    categories: [{ type: String }],
    description: String,
    website: String,
    yearEstablished: Number,
    country: { type: String, default: 'India' },
    minOrderValue: Number,
    documents: [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    leadsReceived: { type: Number, default: 0 },
    leadsQuoted: { type: Number, default: 0 },
    stripeAccountId: String,
    payoutsEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    plan: { type: String, default: 'free' }, // plan key, e.g. buyer_basic / seller_pro
    status: { type: String, enum: ['active', 'past_due', 'canceled', 'none'], default: 'none' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodEnd: Date,
    assignedByAdmin: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: String,
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    adminRole: { type: String, enum: ['super', 'finance', 'support', 'category'] },
    adminCategories: [String], // for category managers
    company: String,
    jobTitle: String,
    address: addressSchema,
    emailVerified: { type: Boolean, default: false },
    otp: { code: { type: String, select: false }, expiresAt: Date, purpose: String },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    seller: sellerSchema,
    subscription: { type: subscriptionSchema, default: () => ({}) },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.checkPassword = function checkPassword(pw) {
  return bcrypt.compare(pw, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const o = this.toObject();
  delete o.password;
  delete o.otp;
  return o;
};

export default mongoose.model('User', userSchema);

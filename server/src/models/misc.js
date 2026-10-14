import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/* ---------- Chat message (buyer ↔ assigned seller, per RFQ) ---------- */
const messageSchema = new mongoose.Schema(
  {
    rfq: { type: ObjectId, ref: 'RFQ', required: true, index: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    text: String,
    attachment: { name: String, url: String },
    readBy: [{ type: ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);
export const Message = mongoose.model('Message', messageSchema);

/* ---------- Review (two-way) ---------- */
const reviewSchema = new mongoose.Schema(
  {
    order: { type: ObjectId, ref: 'Order', required: true },
    from: { type: ObjectId, ref: 'User', required: true },
    to: { type: ObjectId, ref: 'User', required: true, index: true },
    fromRole: { type: String, enum: ['buyer', 'seller'] },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);
reviewSchema.index({ order: 1, from: 1 }, { unique: true });
export const Review = mongoose.model('Review', reviewSchema);

/* ---------- Notification ---------- */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    type: String,
    title: String,
    body: String,
    link: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const Notification = mongoose.model('Notification', notificationSchema);

/* ---------- Subscription plan ---------- */
const planSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    audience: { type: String, enum: ['buyer', 'seller'], required: true },
    name: { type: String, required: true },
    tagline: String,
    priceMonthly: { type: Number, default: 0 }, // USD
    priceYearly: { type: Number, default: 0 },
    features: [String],
    limits: {
      rfqsPerMonth: { type: Number, default: 3 }, // buyers; -1 = unlimited
      categories: { type: Number, default: 2 }, // sellers
      priority: { type: Number, default: 0 }, // higher shown first on admin assignment screen
    },
    stripePriceId: String,
    highlighted: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Plan = mongoose.model('Plan', planSchema);

/* ---------- Dispute ---------- */
const disputeSchema = new mongoose.Schema(
  {
    order: { type: ObjectId, ref: 'Order', required: true },
    openedBy: { type: ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['not_received', 'not_as_described', 'damaged', 'quantity_short', 'late', 'other'] },
    description: String,
    status: { type: String, enum: ['open', 'under_review', 'resolved_refund', 'resolved_release', 'resolved_partial', 'closed'], default: 'open' },
    assignedTo: { type: ObjectId, ref: 'User' },
    thread: [
      {
        _id: false,
        by: { type: ObjectId, ref: 'User' },
        role: String,
        text: String,
        internal: { type: Boolean, default: false },
        at: { type: Date, default: Date.now },
      },
    ],
    resolution: { note: String, refundAmount: Number, by: { type: ObjectId, ref: 'User' }, at: Date },
  },
  { timestamps: true }
);
export const Dispute = mongoose.model('Dispute', disputeSchema);

/* ---------- Audit log ---------- */
const auditSchema = new mongoose.Schema(
  {
    admin: { type: ObjectId, ref: 'User' },
    action: String,
    entity: String,
    entityId: String,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true }
);
export const AuditLog = mongoose.model('AuditLog', auditSchema);

/* ---------- Contact enquiries from website ---------- */
const enquirySchema = new mongoose.Schema(
  { name: String, email: String, company: String, phone: String, message: String, handled: { type: Boolean, default: false } },
  { timestamps: true }
);
export const Enquiry = mongoose.model('Enquiry', enquirySchema);

/* ---------- Atomic counters for human-readable numbers (RFQ-2026-00001) ---------- */
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);
export async function nextSeq(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

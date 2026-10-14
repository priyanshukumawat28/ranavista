import mongoose from 'mongoose';
import { nextSeq } from './misc.js';

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specs: String,
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'pcs' },
  targetUnitPrice: Number, // USD
  cbmPerUnit: { type: Number, default: 0 }, // cubic meters per unit (carton)
  weightKgPerUnit: { type: Number, default: 0 },
});

const historySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['created', 'assigned', 'reassigned', 'unassigned', 'expired', 'quoted', 'accepted', 'cancelled', 'closed'] },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const rfqSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: String,
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    budget: Number, // total budget USD
    currency: { type: String, default: 'USD' },
    deadline: { type: Date, required: true },
    incoterm: { type: String, default: 'FOB' },
    containerType: { type: String, enum: ['none', '20ft', '40ft', '40ft_hc'], default: 'none' },
    destination: { city: String, state: String, zip: String, country: { type: String, default: 'United States' } },
    attachments: [{ name: String, url: String }],
    status: {
      type: String,
      enum: ['pending', 'assigned', 'quoted', 'negotiating', 'accepted', 'closed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    assignedSeller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    responseDueAt: Date,
    lockedUntil: Date, // assignment lock — prevents two admins pushing simultaneously
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: [historySchema],
    adminNotes: String,
  },
  { timestamps: true }
);

rfqSchema.pre('save', async function num(next) {
  if (this.number) return next();
  const year = new Date().getFullYear();
  const seq = await nextSeq(`rfq-${year}`);
  this.number = `RFQ-${year}-${String(seq).padStart(5, '0')}`;
  next();
});

export default mongoose.model('RFQ', rfqSchema);

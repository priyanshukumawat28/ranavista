import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  {
    itemId: mongoose.Schema.Types.ObjectId,
    name: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    cbmPerUnit: Number,
    weightKgPerUnit: Number,
  },
  { _id: false }
);

const roundSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ['buyer', 'seller'] },
    lines: [lineSchema],
    total: Number,
    message: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const quoteSchema = new mongoose.Schema(
  {
    rfq: { type: mongoose.Schema.Types.ObjectId, ref: 'RFQ', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lines: [lineSchema],
    shippingCost: { type: Number, default: 0 },
    total: Number,
    currency: { type: String, default: 'USD' },
    leadTimeDays: Number,
    validUntil: Date,
    incoterm: String,
    paymentTerms: String,
    notes: String,
    status: {
      type: String,
      enum: ['submitted', 'countered', 'revised', 'accepted', 'rejected', 'withdrawn'],
      default: 'submitted',
    },
    rounds: [roundSchema],
  },
  { timestamps: true }
);

export function calcTotal(lines, shipping = 0) {
  const sub = lines.reduce((s, l) => s + Number(l.unitPrice || 0) * Number(l.quantity || 0), 0);
  return Math.round((sub + Number(shipping || 0)) * 100) / 100;
}

export default mongoose.model('Quote', quoteSchema);

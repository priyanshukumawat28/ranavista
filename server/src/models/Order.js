import mongoose from 'mongoose';
import { nextSeq } from './misc.js';

const ledgerSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['charge', 'hold', 'release', 'refund', 'fee', 'chargeback', 'note'] },
    amount: Number,
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ref: String, // stripe id
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true },
    rfq: { type: mongoose.Schema.Types.ObjectId, ref: 'RFQ', required: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lines: [
      {
        _id: false,
        name: String,
        quantity: Number,
        unit: String,
        unitPrice: Number,
        cbmPerUnit: Number,
        weightKgPerUnit: Number,
      },
    ],
    shippingCost: { type: Number, default: 0 },
    subtotal: Number,
    total: Number,
    platformFee: Number,
    sellerPayout: Number,
    currency: { type: String, default: 'USD' },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'held', 'released', 'refunded', 'disputed', 'chargeback'],
      default: 'unpaid',
      index: true,
    },
    fulfillment: { type: String, enum: ['awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'awaiting_payment' },
    tracking: { carrier: String, number: String, note: String },
    stripePaymentIntentId: String,
    stripeTransferId: String,
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    releasedAt: Date,
    refundedAt: Date,
    invoiceFile: String,
    ledger: [ledgerSchema],
    reviewedByBuyer: { type: Boolean, default: false },
    reviewedBySeller: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function num(next) {
  if (this.number) return next();
  const year = new Date().getFullYear();
  const seq = await nextSeq(`order-${year}`);
  this.number = `RV-${year}-${String(seq).padStart(5, '0')}`;
  next();
});

export default mongoose.model('Order', orderSchema);

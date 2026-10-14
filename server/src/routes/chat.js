import { Router } from 'express';
import RFQ from '../models/RFQ.js';
import { Message } from '../models/misc.js';
import { auth } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { getIO } from '../socket.js';
import { notify } from '../services/notify.js';

/*
 * Chat is scoped to one RFQ and only open between the buyer and the CURRENTLY assigned seller,
 * and only after the seller has sent a quote (so buyers aren't contacted before a real offer).
 * Admins can read every thread for moderation & disputes.
 */
const r = Router();
r.use(auth);

async function access(req) {
  const rfq = await RFQ.findById(req.params.rfqId).select('buyer assignedSeller status number title');
  if (!rfq) throw new HttpError(404, 'Conversation not found.');
  const uid = String(req.user._id);
  const isBuyer = String(rfq.buyer) === uid;
  const isSeller = rfq.assignedSeller && String(rfq.assignedSeller) === uid;
  if (req.user.role !== 'admin' && !isBuyer && !isSeller) throw new HttpError(404, 'Conversation not found.');
  return { rfq, isBuyer, isSeller };
}

r.get('/:rfqId', ah(async (req, res) => {
  const { rfq } = await access(req);
  const messages = await Message.find({ rfq: rfq._id }).sort('createdAt').populate('sender', 'name company role').lean();
  await Message.updateMany({ rfq: rfq._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  const open = !!rfq.assignedSeller && ['quoted', 'negotiating', 'accepted'].includes(rfq.status);
  res.json({ messages, open });
}));

r.post('/:rfqId', ah(async (req, res) => {
  const { rfq, isBuyer, isSeller } = await access(req);
  if (!isBuyer && !isSeller) throw new HttpError(403, 'Admins can read but not post in buyer–seller chat.');
  if (!['quoted', 'negotiating', 'accepted'].includes(rfq.status)) throw new HttpError(400, 'Chat opens once the seller has sent a quotation.');
  const text = String(req.body.text || '').trim().slice(0, 4000);
  if (!text && !req.body.attachment) throw new HttpError(400, 'Message is empty.');
  const msg = await Message.create({ rfq: rfq._id, sender: req.user._id, text, attachment: req.body.attachment, readBy: [req.user._id] });
  const full = await msg.populate('sender', 'name company role');
  const to = isBuyer ? rfq.assignedSeller : rfq.buyer;
  const io = getIO();
  [to, req.user._id].forEach((u) => io?.to(`user:${u}`).emit('message', { rfqId: String(rfq._id), message: full }));
  // Light-touch notification (no email) for every message
  notify(to, {
    type: 'message', title: `New message on ${rfq.number}`, body: text.slice(0, 120),
    link: isBuyer ? `/seller/leads/${rfq._id}` : `/buyer/rfqs/${rfq._id}`, email: false,
  });
  res.status(201).json(full);
}));

export default r;

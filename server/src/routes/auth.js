import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { auth, signToken } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { sendMail } from '../services/mailer.js';
import { notifyAdmins } from '../services/notify.js';
import { planFor } from '../utils/plans.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

async function issueOtp(user, purpose) {
  const code = String(crypto.randomInt(100000, 999999));
  user.otp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000), purpose };
  await user.save();
  const title = purpose === 'reset' ? 'Reset your password' : 'Verify your email';
  await sendMail(user.email, `${code} is your Ranavista code`, title, `Your one-time code is <b style="font-size:22px;letter-spacing:4px;color:#0D3B32">${code}</b><br/>It expires in 10 minutes.`);
  if (!process.env.SMTP_HOST) console.log(`🔐 OTP for ${user.email}: ${code}`);
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/* Register — buyer or seller (separate flows on the frontend) */
r.post('/register', limiter, ah(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['buyer', 'seller'].includes(role)) throw new HttpError(400, 'Choose buyer or seller.');
  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists.');

  const data = { ...pick(req.body, ['name', 'email', 'password', 'phone', 'company', 'jobTitle', 'address']), role };
  if (role === 'seller') {
    data.seller = {
      approval: 'pending',
      categories: (req.body.categories || []).slice(0, 10),
      description: req.body.description,
      website: req.body.website,
      country: req.body.country || 'India',
      yearEstablished: req.body.yearEstablished,
    };
  }
  const user = await User.create(data);
  await issueOtp(user, 'verify');
  if (role === 'seller') {
    notifyAdmins({ type: 'seller_signup', title: 'New seller awaiting verification', body: `${user.company || user.name} signed up as a seller.`, link: `/sellers/${user._id}` }, ['support', 'category']);
  }
  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
}));

r.post('/verify-email', auth, ah(async (req, res) => {
  const user = await User.findById(req.user._id).select('+otp.code');
  if (user.emailVerified) return res.json({ user: user.toSafeJSON() });
  if (!user.otp?.code || user.otp.purpose !== 'verify' || user.otp.expiresAt < new Date()) throw new HttpError(400, 'Code expired. Request a new one.');
  if (user.otp.code !== String(req.body.code).trim()) throw new HttpError(400, 'That code is not correct.');
  user.emailVerified = true;
  user.otp = undefined;
  await user.save();
  res.json({ user: user.toSafeJSON() });
}));

r.post('/resend-otp', auth, limiter, ah(async (req, res) => {
  await issueOtp(req.user, 'verify');
  res.json({ ok: true });
}));

r.post('/login', limiter, ah(async (req, res) => {
  const { email, password, portal } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(password || ''))) throw new HttpError(401, 'Email or password is incorrect.');
  if (portal === 'admin' && user.role !== 'admin') throw new HttpError(403, 'This login is for Ranavista staff only.');
  if (portal !== 'admin' && user.role === 'admin') throw new HttpError(403, 'Admins sign in on the admin panel.');
  if (user.status === 'suspended') throw new HttpError(403, 'Your account is suspended. Contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ token: signToken(user), user: user.toSafeJSON() });
}));

r.post('/forgot-password', limiter, ah(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (user) await issueOtp(user, 'reset');
  res.json({ ok: true }); // never reveal whether the email exists
}));

r.post('/reset-password', limiter, ah(async (req, res) => {
  const { email, code, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+otp.code +password');
  if (!user || user.otp?.purpose !== 'reset' || user.otp.code !== String(code) || user.otp.expiresAt < new Date())
    throw new HttpError(400, 'Invalid or expired code.');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  user.password = password;
  user.otp = undefined;
  user.emailVerified = true;
  await user.save();
  res.json({ ok: true });
}));

r.get('/me', auth, ah(async (req, res) => res.json({ user: req.user.toSafeJSON() })));

r.patch('/me', auth, ah(async (req, res) => {
  const u = req.user;
  Object.assign(u, pick(req.body, ['name', 'phone', 'company', 'jobTitle', 'address']));
  if (u.role === 'seller' && req.body.seller) {
    const s = pick(req.body.seller, ['description', 'website', 'yearEstablished', 'country', 'minOrderValue', 'categories']);
    if (s.categories) {
      const max = (await planFor(u))?.limits?.categories ?? 2;
      if (max !== -1 && s.categories.length > max && s.categories.length > (u.seller.categories?.length || 0)) throw new HttpError(402, `Your plan allows ${max} categories. Upgrade to add more.`, 'PLAN_LIMIT');
    }
    Object.assign(u.seller, s);
  }
  await u.save();
  res.json({ user: u.toSafeJSON() });
}));

r.post('/change-password', auth, ah(async (req, res) => {
  const u = await User.findById(req.user._id).select('+password');
  if (!(await u.checkPassword(req.body.current || ''))) throw new HttpError(400, 'Current password is incorrect.');
  if (!req.body.password || req.body.password.length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
  u.password = req.body.password;
  await u.save();
  res.json({ ok: true });
}));

export default r;

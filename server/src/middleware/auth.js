import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpires });
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Your account is suspended. Contact support.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
}

/** allow('buyer'), allow('seller','admin') … */
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Not allowed for your account type.' });

/** Admin sub-roles. Super admins pass every check. */
export const adminRole = (...roles) => (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only.' });
  if (req.user.adminRole === 'super' || roles.includes(req.user.adminRole)) return next();
  res.status(403).json({ message: 'Your admin role does not have access to this section.' });
};

export const verifiedOnly = (req, res, next) =>
  req.user.emailVerified ? next() : res.status(403).json({ message: 'Please verify your email first.', code: 'EMAIL_UNVERIFIED' });

export const approvedSeller = (req, res, next) =>
  req.user.role === 'seller' && req.user.seller?.approval !== 'approved'
    ? res.status(403).json({ message: 'Your seller account is awaiting admin approval.', code: 'SELLER_PENDING' })
    : next();

import { Notification } from '../models/misc.js';
import User from '../models/User.js';
import { sendMail } from './mailer.js';
import { getIO } from '../socket.js';
import env from '../config/env.js';

/**
 * Create an in-app notification, push it live over socket.io and (optionally) email it.
 * `link` is a path on the user's own app (website or admin panel).
 */
export async function notify(userId, { type, title, body, link, email = true }) {
  const n = await Notification.create({ user: userId, type, title, body, link });
  getIO()?.to(`user:${userId}`).emit('notification', n);
  if (email) {
    const u = await User.findById(userId).select('email role');
    if (u) {
      const base = u.role === 'admin' ? env.adminUrl : env.clientUrl;
      sendMail(u.email, title, title, body, link ? { url: base + link, label: 'Open Ranavista' } : null);
    }
  }
  return n;
}

/** Notify every admin (optionally only certain admin roles). */
export async function notifyAdmins(payload, roles = null) {
  const q = { role: 'admin', status: 'active' };
  if (roles) q.adminRole = { $in: ['super', ...roles] };
  const admins = await User.find(q).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, { ...payload, email: false })));
}

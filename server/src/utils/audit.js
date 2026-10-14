import { AuditLog } from '../models/misc.js';

export function audit(req, action, entity, entityId, meta = {}) {
  return AuditLog.create({
    admin: req.user?._id,
    action,
    entity,
    entityId: String(entityId || ''),
    meta,
    ip: req.ip,
  }).catch((e) => console.error('audit log failed', e.message));
}

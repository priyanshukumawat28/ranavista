import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/*
 * Local disk storage — fine for development & small deployments.
 * For production swap this for S3 / Cloudinary / Cloudflare R2 (multer-s3 etc.)
 * and keep returning a public URL in the same `{ name, url }` shape.
 */
export const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'files'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'invoices'), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'files')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) =>
    allowed.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('File type not allowed')),
});

export const fileToRef = (f) => ({ name: f.originalname, url: `/uploads/files/${f.filename}` });

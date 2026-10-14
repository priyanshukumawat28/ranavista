import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import { errorHandler, notFound } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import { ensurePlans } from './utils/plans.js';
import { startJobs } from './jobs/reminders.js';

import webhookRoutes from './routes/webhook.js';
import authRoutes from './routes/auth.js';
import rfqRoutes from './routes/rfq.js';
import orderRoutes from './routes/orders.js';
import chatRoutes from './routes/chat.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';

const app = express();
const server = http.createServer(app);
initSocket(server);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: [env.clientUrl, env.adminUrl], credentials: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Stripe webhook needs the raw body — mount before JSON parser
app.use('/api/webhooks/stripe', webhookRoutes);
app.use(express.json({ limit: '1mb' }));

// Uploaded RFQ attachments / seller docs (random file names). Invoices are served via an authenticated route.
app.use('/uploads/files', express.static(path.join(UPLOAD_DIR, 'files'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, demoPayments: env.demoPayments }));
app.use('/api/auth', authRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', accountRoutes);

app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(ensurePlans)
  .then(() => {
    server.listen(env.port, () => {
      console.log(`✓ Ranavista API on http://localhost:${env.port}`);
      if (env.demoPayments) console.log('ℹ  Stripe key not set — running payments in DEMO mode');
    });
    startJobs();
  })
  .catch((e) => {
    console.error('Startup failed:', e.message);
    process.exit(1);
  });

import dotenv from 'dotenv';
dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ranavista',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:5174',
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT || 3),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Ranavista <no-reply@ranavista.com>',
  },
  twilio: {
    sid: process.env.TWILIO_SID || '',
    token: process.env.TWILIO_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
  },
  leadResponseHours: Number(process.env.LEAD_RESPONSE_HOURS || 48),
};

env.demoPayments = !env.stripeKey;
export default env;

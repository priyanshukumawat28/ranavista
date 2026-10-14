import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

const wrap = (title, body, cta) => `
<div style="background:#F7F3EA;padding:32px 0;font-family:Poppins,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E8DDD1">
    <div style="background:#0D3B32;padding:20px 28px;color:#fff;font-family:Georgia,serif;font-size:22px;letter-spacing:2px">RANAVISTA</div>
    <div style="padding:28px;color:#1F2D2A">
      <h2 style="font-family:Georgia,serif;margin:0 0 12px;color:#0D3B32">${title}</h2>
      <div style="font-size:15px;line-height:1.6;color:#495057">${body}</div>
      ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#B89B6B;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">${cta.label}</a>` : ''}
    </div>
    <div style="padding:16px 28px;background:#F1F1F1;font-size:12px;color:#6B7A78">Ranavista · Sourcing Today for a Brighter Tomorrow</div>
  </div>
</div>`;

export async function sendMail(to, subject, title, body, cta) {
  if (!transporter) {
    console.log(`\n📧 [email skipped — no SMTP] to=${to} | ${subject}\n   ${body.replace(/<[^>]+>/g, '')}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html: wrap(title, body, cta) });
  } catch (e) {
    console.error('mail failed:', e.message);
  }
}

/** Optional SMS / WhatsApp through Twilio's REST API (no SDK needed). */
export async function sendSms(to, text) {
  if (!env.twilio.sid || !to) return;
  try {
    const auth = Buffer.from(`${env.twilio.sid}:${env.twilio.token}`).toString('base64');
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: env.twilio.from, Body: text }),
    });
  } catch (e) {
    console.error('sms failed:', e.message);
  }
}

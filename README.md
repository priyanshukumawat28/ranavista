# Ranavista — B2B Quotation Marketplace (MERN)

Admin-managed, single-seller lead routing marketplace for home & lifestyle sourcing.
Built for US buyers (USD, US states/ZIP, in/lb ↔ CBM/kg) with the Ranavista brand guide
(Primary Dark Green `#0D3B32`, Brand Gold `#B89B6B`, Warm Cream `#F7F3EA`, Playfair Display + Poppins).

```
ranavista/
├── server/   Express + MongoDB API, Socket.io chat, Stripe Connect + Billing, PDF invoices, cron reminders
├── client/   Website + Buyer dashboard + Seller dashboard   (www.yourdomain.com)
└── admin/    Admin panel                                     (manage.yourdomain.com)
```

---

## 1. Run it on your computer

**Needs:** Node.js 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
cd ranavista
npm install                 # installs "concurrently" for the root dev script
npm run install:all         # installs server, client, admin

cp server/.env.example server/.env     # then edit MONGO_URI and JWT_SECRET
npm run seed:demo           # plans + super admin + demo buyer/sellers/RFQs
npm run dev                 # API :5000 · website :5173 · admin :5174
```

| App | URL | Login |
|---|---|---|
| Website | http://localhost:5173 | `buyer@demo.com` / `Demo@12345` |
| Seller | http://localhost:5173 | `seller1@demo.com` … `seller4@demo.com` / `Demo@12345` |
| Admin | http://localhost:5174 | `admin@ranavista.com` / `Admin@12345` (from `.env`) |

**Demo mode:** with `STRIPE_SECRET_KEY` empty, payments, payouts and paid plans are simulated so you can click through
the full flow. With `SMTP_HOST` empty, OTP codes and emails are printed in the **server terminal**.

### Try the full flow (5 minutes)
1. **Admin → Pending queue** → open a demo RFQ → Seller Selection Panel → *Push lead* to one seller.
2. **Seller** (`seller1@demo.com`) → My leads → enter unit prices → *Send quotation*.
3. **Buyer** → My RFQs → open it → *Counter-offer* or *Accept* → chat with the seller.
4. Buyer → Order → *Pay securely* (instant in demo) → funds show **held**; PDF invoice is generated.
5. Seller → *Mark as shipped* → Buyer → *Confirm delivery* → funds **released**, both sides leave reviews.
6. Admin → Transactions / Disputes / Revenue / Audit log to see every step recorded.

---

## 2. What's included

**Website (client)** — Home, About, Products, Sourcing Countries, Trade Fairs, Pricing, Contact, Privacy/Terms ·
separate buyer & seller sign-up · email OTP verification · forgot/reset password.

**Buyer** — dashboard · post RFQ (multi-item cart, imperial or metric carton specs, attachments, auto-saved draft) ·
**Container Fill Optimizer** (20′/40′/40′HC by CBM + weight, smallest-container recommendation, "add more to optimize"
with one-click fill) · quote review with target-price comparison · counter-offer / accept / decline (and request
another seller) · real-time chat · Stripe Checkout payment held in escrow · confirm delivery · disputes · PDF invoice ·
reviews · plans & billing · notifications.

**Seller** — dashboard · exclusive leads with response-window countdown · line-by-line quotation · revise after counter ·
decline lead · chat · ship with tracking · Stripe Connect payouts · reviews · company profile & verification documents ·
plans.

**Admin panel** — role-based (Super Admin, Finance, Support, Category Manager) · dashboard KPIs ·
**Pending RFQ Queue** · **Seller Selection Panel** (category-matched sellers side-by-side with rating, tier, response
rate, open leads, payout status) · single-seller push with **assignment lock**, response window, reassign / pull back ·
full **audit trail** · seller verification · buyers · **transaction control center** (all orders, buyer ledger, seller
ledger, manual release / full or partial refund, ledger notes, chargebacks) · **dispute workspace** (public replies +
internal notes, chat transcript, refund / release / partial) · subscription plans (edit prices, Stripe Price IDs,
limits) and per-user plan assignment · revenue (MRR, ARR, churn, tiers, fees by month, GMV by category) ·
review moderation · website enquiries · admin team management.

**Automations** (hourly) — quote-due reminders to sellers, overdue-lead alerts to admins, buyer deadline reminders,
unpaid-order and delivery-confirmation nudges.

Out of scope as agreed (Phase 2): freight booking, 3D bin-packing, multi-container split, commission/lead-credits,
mobile app, multi-language/currency.

---

## 3. Go live for free (starter setup)

| Piece | Free option | Notes |
|---|---|---|
| Database | **MongoDB Atlas** M0 | Copy the connection string into `MONGO_URI`. |
| API (`server/`) | **Render** Web Service (free) | Build `npm install`, start `npm start`. Free tier sleeps after inactivity — first request takes ~30–50 s. |
| Website (`client/`) | **Vercel** or **Netlify** | Root dir `client`, build `npm run build`, output `dist`. Set `VITE_API_URL=https://api.yourdomain.com`. |
| Admin (`admin/`) | **Vercel** or **Netlify** (2nd project) | Root dir `admin`, same settings, custom domain `manage.yourdomain.com`. |

SPA routing files (`vercel.json`, `public/_redirects`) are already included.

**Server environment on Render:** copy every key from `server/.env.example`, and set
`CLIENT_URL=https://www.yourdomain.com`, `ADMIN_URL=https://manage.yourdomain.com`, `API_URL=https://api.yourdomain.com`.
Then open the Render shell once and run `npm run seed` to create plans and the first Super Admin.

**File uploads:** stored on the server disk (`server/uploads`). Render's free disk is wiped on redeploy — before real
launch switch `server/src/middleware/upload.js` to S3 / Cloudinary / Cloudflare R2 (the rest of the code doesn't change).

---

## 4. Turn on real payments (Stripe)

1. Create a Stripe account → enable **Connect** (Express accounts) and **Billing**.
2. Put the secret key in `STRIPE_SECRET_KEY`.
3. Products → create a recurring Price for each paid plan → paste each `price_…` into **Admin → Subscriptions → Edit plan**.
4. Developers → Webhooks → endpoint `https://api.yourdomain.com/api/webhooks/stripe` with events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `charge.dispute.created`, `account.updated`.
   Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Settings → Billing → Customer portal → activate (used by the "Manage billing" button).

**Escrow model:** buyer pays the platform (Stripe Checkout) → money is **held** in your Stripe balance → on delivery
confirmation (or admin decision) a **Transfer** sends `total − platform fee` to the seller's connected account.
`PLATFORM_FEE_PERCENT` controls the fee.

> ⚠️ Check Stripe's cross-border payout country list for your sellers' countries before launch. If a seller's country
> isn't supported, keep the order held and pay them outside Stripe, then record it with a ledger note.
> Holding funds for long periods may require Stripe's approval for your account — confirm with Stripe and your
> lawyer that the escrow-style flow fits your business before going live.

---

## 5. Email, SMS & WhatsApp

- **Email:** any SMTP (Gmail app password, Zoho, Brevo, SendGrid, Amazon SES) → `SMTP_*` keys.
- **SMS/WhatsApp (optional):** Twilio keys in `.env`; `sendSms()` in `server/src/services/mailer.js` is ready to call
  from `notify()` for the events you want.

---

## 6. API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register · login · verify-email · resend-otp · forgot-password · reset-password` · `GET/PATCH /api/auth/me` |
| RFQ | `POST /api/rfqs` · `GET /api/rfqs` · `GET /api/rfqs/:id` · `POST /api/rfqs/:id/cancel · decline · quote` · `POST /api/rfqs/container-fill` |
| Quotes | `POST /api/rfqs/quotes/:id/counter · revise · accept · reject` |
| Orders | `GET /api/orders` · `GET /api/orders/:id` · `POST …/pay · verify-payment · ship · confirm-delivery · dispute · dispute/message · review` · `GET …/invoice` |
| Chat | `GET/POST /api/chat/:rfqId` (+ Socket.io `message`, `notification` events) |
| Account | `/api/notifications` · `/api/dashboard` · `/api/subscription` · `/api/payouts` · `/api/uploads` · `/api/public/*` |
| Admin | `/api/admin/overview · rfqs · rfqs/:id/candidates · lock · assign · reassign · unassign · users · orders · ledgers · disputes · plans · revenue · audit · team …` |

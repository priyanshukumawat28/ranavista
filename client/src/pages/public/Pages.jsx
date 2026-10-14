import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Compass, Gem, Leaf, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { CATEGORIES, usd0 } from '../../lib/format';
import { Alert, Button, Field, Input, PageLoader, Textarea, cx } from '../../components/ui';
import { LotusMark } from '../../components/Logo';

export function PageHero({ eyebrow, title, text }) {
  return (
    <section className="bg-hero relative overflow-hidden text-white">
      <div className="bg-grain absolute inset-0 opacity-40" aria-hidden />
      <LotusMark className="absolute -right-10 top-6 h-48 w-56 opacity-10" color="#fff" />
      <div className="container-x relative py-16 sm:py-20">
        <p className="text-xs uppercase tracking-[0.25em] text-gold-light">{eyebrow}</p>
        <h1 className="rise mt-3 max-w-3xl text-4xl sm:text-5xl">{title}</h1>
        {text && <p className="rise rise-2 mt-4 max-w-2xl text-white/75">{text}</p>}
      </div>
    </section>
  );
}

/* ----------------------------- ABOUT ----------------------------- */
export function About() {
  const values = [
    { icon: Compass, title: 'Global Sourcing', text: 'We work with makers across India, Vietnam, Turkey, Indonesia, Mexico and Portugal — places with deep craft traditions.' },
    { icon: ShieldCheck, title: 'Trusted Partnerships', text: 'Every seller is verified by our team. Every payment is protected until delivery. Every dispute gets a human.' },
    { icon: Gem, title: 'Timeless Value', text: 'We favor durable, well-made goods and long-term buyer–maker relationships over one-off transactions.' },
    { icon: Leaf, title: 'Sustainable by design', text: 'Container planning cuts wasted freight, and we spotlight makers with responsible materials and fair labor.' },
  ];
  return (
    <>
      <PageHero eyebrow="About Ranavista" title="Connecting the world to exceptional home & lifestyle products" text="Ranavista was built for independent retailers, e-commerce brands and interior studios who want factory-direct pricing without the risk and noise of open marketplaces." />
      <section className="container-x grid gap-12 py-20 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Our approach</p>
          <h2 className="mt-3 text-3xl text-forest">A sourcing desk, not a search box</h2>
          <div className="mt-5 space-y-4 text-ink-medium">
            <p>Open B2B marketplaces send your request to dozens of suppliers at once. You get flooded with replies, many from traders rather than makers, and you’re left to vet them alone.</p>
            <p>Ranavista does the opposite. Every request lands with our sourcing team first. We review it, then hand it to the one verified manufacturer we believe fits best — by category, capacity, track record and responsiveness.</p>
            <p>If that seller can’t deliver a strong quote, we route your request to the next one. You only ever deal with one serious partner at a time.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="card card-pad">
              <v.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 text-lg text-forest">{v.title}</h3>
              <p className="mt-1.5 text-sm text-ink-medium">{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <CTA />
    </>
  );
}

/* ----------------------------- CATEGORIES ----------------------------- */
const CAT_INFO = {
  'Home Decor': 'Vases, wall art, candle holders, decorative trays, metal & brass accents.',
  Furniture: 'Solid wood, rattan, iron and upholstered pieces — KD options for container efficiency.',
  'Home Textiles': 'Bedding, table linen, cushions, throws, curtains — block print to jacquard.',
  'Rugs & Carpets': 'Hand-knotted, hand-tufted, flat-weave and jute rugs in custom sizes.',
  'Kitchen & Dining': 'Serveware, cutlery, wooden boards, enamelware, glassware.',
  Lighting: 'Pendant and table lamps, lanterns, rattan and metal shades.',
  'Bath & Spa': 'Turkish towels, bath mats, organic cotton robes, accessories.',
  'Garden & Outdoor': 'Planters, outdoor furniture, garden decor, weatherproof textiles.',
  Handicrafts: 'Artisan-made pieces — wood carving, stone, papier-mâché, pottery.',
  'Fashion Accessories': 'Bags, scarves, belts and small accessories.',
  Jewelry: 'Fashion and fine jewelry, private label collections.',
  Apparel: 'Cut-and-sew garments, organic cotton basics, resort wear.',
  'Leather Goods': 'Bags, wallets, home leather accents.',
  'Gifts & Seasonal': 'Holiday decor, gift sets, seasonal collections.',
  Packaging: 'Custom boxes, gift packaging, eco-friendly shipping materials.',
  Other: 'Don’t see your product? Post an RFQ and our team will find the right maker.',
};
export function Categories() {
  return (
    <>
      <PageHero eyebrow="Products" title="Categories we source" text="Post an RFQ in any category below. We match it to a verified manufacturer specializing in exactly that." />
      <section className="container-x grid gap-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <div key={c} id={c} className="card card-pad group flex flex-col scroll-mt-28">
            <h3 className="text-xl text-forest">{c}</h3>
            <p className="mt-2 flex-1 text-sm text-ink-medium">{CAT_INFO[c]}</p>
            <Link to={`/register?role=buyer&category=${encodeURIComponent(c)}`} className="link mt-4 inline-flex items-center gap-1 text-sm">Request quotes <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></Link>
          </div>
        ))}
      </section>
    </>
  );
}

/* ----------------------------- SOURCING COUNTRIES ----------------------------- */
const COUNTRIES = [
  { name: 'India', flag: '🇮🇳', strengths: ['Home textiles', 'Handicrafts', 'Rugs', 'Brass & metal', 'Jewelry'], text: 'Our deepest network — Jaipur, Moradabad, Panipat, Bhadohi, Karur and beyond.' },
  { name: 'Vietnam', flag: '🇻🇳', strengths: ['Furniture', 'Ceramics', 'Bamboo & rattan'], text: 'Fast-growing furniture and lifestyle hub with strong export compliance.' },
  { name: 'Turkey', flag: '🇹🇷', strengths: ['Towels', 'Glassware', 'Rugs'], text: 'Premium cotton textiles and glass with short transit to the East Coast.' },
  { name: 'Indonesia', flag: '🇮🇩', strengths: ['Teak furniture', 'Woven goods'], text: 'Solid-wood furniture and natural-fiber craft from Java and Bali.' },
  { name: 'Mexico', flag: '🇲🇽', strengths: ['Pottery', 'Talavera', 'Leather'], text: 'Nearshore option with truck delivery and USMCA advantages.' },
  { name: 'Portugal', flag: '🇵🇹', strengths: ['Ceramics', 'Cork', 'Linen'], text: 'European craftsmanship for premium tableware and textiles.' },
];
export function Sourcing() {
  return (
    <>
      <PageHero eyebrow="Sourcing countries" title="Where our makers are" text="We focus on countries with strong craft heritage and reliable export infrastructure to US ports." />
      <section className="container-x grid gap-5 py-16 md:grid-cols-2 lg:grid-cols-3">
        {COUNTRIES.map((c) => (
          <div key={c.name} className="card card-pad">
            <div className="flex items-center gap-3"><span className="text-4xl" aria-hidden>{c.flag}</span><h3 className="text-2xl text-forest">{c.name}</h3></div>
            <p className="mt-3 text-sm text-ink-medium">{c.text}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{c.strengths.map((s) => <span key={s} className="rounded-full bg-cream px-2.5 py-1 text-xs text-ink">{s}</span>)}</div>
          </div>
        ))}
      </section>
      <CTA />
    </>
  );
}

/* ----------------------------- TRADE FAIRS ----------------------------- */
const FAIRS = [
  { name: 'IHGF Delhi Fair (Autumn)', country: '🇮🇳 India', when: 'Oct 14 – 18, 2026', where: 'India Expo Centre, Greater Noida', tags: ['Home', 'Lifestyle', 'Textiles'] },
  { name: 'High Point Market', country: '🇺🇸 United States', when: 'April & October', where: 'High Point, North Carolina', tags: ['Furniture', 'Home'] },
  { name: 'Las Vegas Market', country: '🇺🇸 United States', when: 'January & July', where: 'World Market Center, Las Vegas', tags: ['Furniture', 'Decor', 'Gift'] },
  { name: 'NY NOW', country: '🇺🇸 United States', when: 'February & August', where: 'Javits Center, New York', tags: ['Home', 'Gift', 'Lifestyle'] },
  { name: 'Ambiente', country: '🇩🇪 Germany', when: 'February', where: 'Messe Frankfurt', tags: ['Dining', 'Living', 'Giving'] },
  { name: 'Heimtextil', country: '🇩🇪 Germany', when: 'January', where: 'Messe Frankfurt', tags: ['Home textiles'] },
];
export function TradeFairs() {
  return (
    <>
      <PageHero eyebrow="Trade fairs" title="Meet our makers in person" text="Our team and sellers attend the leading home & lifestyle fairs. Enterprise members can book factory and booth visits through their sourcing manager." />
      <section className="container-x grid gap-5 py-16 md:grid-cols-2 lg:grid-cols-3">
        {FAIRS.map((f) => (
          <div key={f.name} className="card card-pad">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-forest p-2.5 text-gold-light"><Calendar className="h-5 w-5" /></div>
              <div><h3 className="text-lg text-forest">{f.name}</h3><p className="text-sm text-ink-medium">{f.country}</p></div>
            </div>
            <p className="mt-4 text-sm font-medium text-ink">{f.when}</p>
            <p className="flex items-center gap-1.5 text-sm text-ink-medium"><MapPin className="h-3.5 w-3.5" />{f.where}</p>
            <p className="mt-3 text-sm text-muted">{f.tags.join(' | ')}</p>
          </div>
        ))}
        <p className="text-xs text-ink-medium md:col-span-2 lg:col-span-3">Recurring fair months shown for planning — confirm exact dates on each organizer’s website.</p>
      </section>
    </>
  );
}

/* ----------------------------- PRICING ----------------------------- */
export function Pricing() {
  const { data: plans, loading } = useFetch('/public/plans');
  const [aud, setAud] = useState('buyer');
  const [yearly, setYearly] = useState(false);
  const list = (plans || []).filter((p) => p.audience === aud);
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple plans in USD. No markup on quotes." text="Buyers and sellers each pick a plan. Ranavista keeps a small platform fee only when an order completes." />
      <section className="container-x py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex rounded-xl bg-white p-1 shadow-soft ring-1 ring-beige">
            {['buyer', 'seller'].map((a) => (
              <button key={a} onClick={() => setAud(a)} className={cx('rounded-lg px-5 py-2 text-sm capitalize transition', aud === a ? 'bg-forest text-white' : 'text-ink-medium')}>For {a}s</button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-medium">
            <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} className="accent-forest" /> Bill yearly <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold-dark">2 months free</span>
          </label>
        </div>
        {loading ? <PageLoader /> : (
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            {list.map((p) => (
              <div key={p.key} className={cx('relative flex flex-col rounded-2xl border bg-white p-7', p.highlighted ? 'border-gold shadow-lift' : 'border-beige shadow-soft')}>
                {p.highlighted && <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">Most popular</span>}
                <h3 className="text-2xl text-forest">{p.name}</h3>
                <p className="mt-1 text-sm text-ink-medium">{p.tagline}</p>
                <p className="mt-5">
                  <span className="font-serif text-4xl text-ink">{p.priceMonthly === 0 ? 'Free' : usd0(yearly ? p.priceYearly / 12 : p.priceMonthly)}</span>
                  {p.priceMonthly > 0 && <span className="text-sm text-ink-medium"> /month{yearly && ', billed yearly'}</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}</li>)}
                </ul>
                <Link to={`/register?role=${aud}&plan=${p.key}`} className={cx('mt-7', p.highlighted ? 'btn-primary' : 'btn-outline')}>{p.priceMonthly === 0 ? 'Get started free' : `Choose ${p.name}`}</Link>
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-xs text-ink-medium">Card processing, ACH and wire fees are charged at cost by Stripe. Freight and duties are quoted by sellers or your forwarder.</p>
      </section>
    </>
  );
}

/* ----------------------------- CONTACT ----------------------------- */
export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', message: '' });
  const [state, setState] = useState({ busy: false, ok: false, err: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, err: '' });
    try { await api.post('/public/contact', form); setState({ busy: false, ok: true, err: '' }); setForm({ name: '', email: '', company: '', phone: '', message: '' }); }
    catch (x) { setState({ busy: false, ok: false, err: errMsg(x) }); }
  };
  return (
    <>
      <PageHero eyebrow="Contact us" title="Talk to our sourcing team" text="Questions about a product, a plan, or becoming a seller? We reply within one US business day." />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          {[[Mail, 'Email', 'hello@ranavista.com', 'mailto:hello@ranavista.com'], [Phone, 'Phone (US)', '+1 (800) 555-0199', 'tel:+18005550199'], [MapPin, 'Hours', 'Mon–Fri, 9am–6pm ET', null]].map(([I, l, v, h]) => (
            <div key={l} className="card card-pad flex items-center gap-4">
              <div className="rounded-xl bg-forest p-3 text-gold-light"><I className="h-5 w-5" /></div>
              <div><p className="text-xs uppercase tracking-wider text-ink-medium">{l}</p>{h ? <a href={h} className="font-medium text-forest">{v}</a> : <p className="font-medium text-forest">{v}</p>}</div>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="card card-pad grid gap-4 sm:grid-cols-2">
          {state.ok && <Alert type="success" className="sm:col-span-2">Thanks — we’ve received your message and will be in touch shortly.</Alert>}
          {state.err && <Alert type="error" className="sm:col-span-2">{state.err}</Alert>}
          <Field label="Full name"><Input required value={form.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Work email"><Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Company"><Input value={form.company} onChange={set('company')} autoComplete="organization" /></Field>
          <Field label="Phone"><Input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 555-5555" autoComplete="tel" /></Field>
          <Field label="How can we help?" className="sm:col-span-2"><Textarea required rows={5} value={form.message} onChange={set('message')} /></Field>
          <div className="sm:col-span-2"><Button loading={state.busy} size="lg">Send message</Button></div>
        </form>
      </section>
    </>
  );
}

/* ----------------------------- LEGAL ----------------------------- */
export function Legal({ kind }) {
  const privacy = kind === 'privacy';
  return (
    <>
      <PageHero eyebrow="Legal" title={privacy ? 'Privacy Policy' : 'Terms & Conditions'} />
      <section className="container-x max-w-3xl space-y-4 py-14 text-ink-medium">
        <Alert type="warning">Template text — have your attorney review and replace before launch.</Alert>
        {privacy ? (
          <>
            <p>Ranavista collects the information you provide (name, company, contact details, RFQs, messages and documents) to operate the marketplace, route requests, process payments and provide support.</p>
            <p>Payments are processed by Stripe; we never store full card numbers. We share buyer details with the assigned seller only as needed to quote and fulfil an order.</p>
            <p>California residents may request access to or deletion of personal information by emailing privacy@ranavista.com. We do not sell personal information.</p>
          </>
        ) : (
          <>
            <p>By using Ranavista you agree that RFQs are routed at Ranavista’s discretion to a single seller, and that quotations are offers from independent sellers, not from Ranavista.</p>
            <p>Buyer payments are held by Ranavista and released to the seller when the buyer confirms delivery, or as decided by Ranavista under the dispute process.</p>
            <p>Subscriptions renew automatically until cancelled. Platform fees are non-refundable once an order is released.</p>
          </>
        )}
      </section>
    </>
  );
}

function CTA() {
  return (
    <section className="container-x pb-20">
      <div className="bg-hero relative overflow-hidden rounded-[1.75rem] px-8 py-12 text-center text-white sm:px-16">
        <h2 className="text-3xl sm:text-4xl">Ready to source smarter?</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/75">Post your first RFQ free. Our team will match it with a verified maker within 24–48 hours.</p>
        <Link to="/register?role=buyer" className="btn-gold btn-lg mt-7">Post a free RFQ <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}

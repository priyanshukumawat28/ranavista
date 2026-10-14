import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Box, CheckCircle2, ClipboardList, FileText, Globe2, Handshake, Lock, MessageSquare, ShieldCheck, Sparkles, Truck, UserCheck,
} from 'lucide-react';
import { LotusMark } from '../../components/Logo';
import { CATEGORIES } from '../../lib/format';

const STEPS = [
  { icon: ClipboardList, title: 'Post your RFQ', text: 'Tell us what you need — items, quantities, target price, deadline and delivery ZIP. Takes about 3 minutes.' },
  { icon: UserCheck, title: 'We hand-pick one seller', text: 'Our sourcing team reviews every request and routes it to the single best-fit verified manufacturer. No spam, no bidding wars.' },
  { icon: Handshake, title: 'Review & negotiate', text: 'Get a line-by-line quotation in USD. Accept it, or counter-offer and chat directly with the seller.' },
  { icon: ShieldCheck, title: 'Pay safely, release on delivery', text: 'Your payment is held by Ranavista and released to the seller only after you confirm the goods arrived.' },
];

const FEATURES = [
  { icon: BadgeCheck, title: 'Verified manufacturers only', text: 'Business documents, export history and capacity are checked before a seller can receive a single lead.' },
  { icon: Lock, title: 'Escrow-style protection', text: 'Funds are held securely via Stripe. If something goes wrong, our dispute team steps in.' },
  { icon: Box, title: 'Container fill planner', text: 'See how full your 20′, 40′ or 40′ HC container is by volume and weight — and what to add to lower landed cost.' },
  { icon: MessageSquare, title: 'One conversation, one seller', text: 'Chat, files and negotiation history live in one place — no inbox flooded by dozens of suppliers.' },
  { icon: FileText, title: 'Automatic invoices', text: 'A clean PDF invoice is generated for every order, ready for your accountant.' },
  { icon: Globe2, title: 'Built for US buyers', text: 'USD pricing, imperial conversions, US business hours support, and sellers experienced with US compliance.' },
];

const FAQ = [
  ['Why only one seller per RFQ?', 'Quality over quantity. Our team matches your request to the manufacturer best suited by category, capacity and track record — so you get a serious quote instead of 40 emails.'],
  ['What if I don’t like the quote?', 'Counter-offer in the app, or decline and ask us to route your RFQ to a different seller at no extra cost.'],
  ['How does payment protection work?', 'You pay through Stripe. Ranavista holds the funds and releases them to the seller only after you confirm delivery. Open a dispute any time while funds are on hold.'],
  ['Is there a fee for buyers?', 'Posting RFQs is free on the Basic plan (3 per month). Growth and Enterprise plans add more RFQs and faster routing. There is no markup on seller quotes.'],
];

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-6 rounded-[2rem] bg-gold/10 blur-2xl" aria-hidden />
      <div className="rise rise-2 relative rounded-2xl bg-white p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.2em] text-gold-dark">RFQ-2026-00418</span>
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">Quote received</span>
        </div>
        <p className="mt-2 font-serif text-xl text-forest">Hand-block printed table linens</p>
        <p className="text-xs text-ink-medium">Home Textiles · FOB · Ship to Austin, TX 78701</p>
        <div className="mt-4 space-y-2 text-sm">
          {[['Table runner 14×72 in', '3,000 pcs', '$3.85'], ['Napkin set of 4', '5,000 sets', '$2.90']].map(([n, q, p]) => (
            <div key={n} className="flex items-center justify-between rounded-lg bg-cream/70 px-3 py-2">
              <span className="text-ink">{n}<span className="ml-2 text-xs text-ink-medium">{q}</span></span>
              <span className="font-medium text-forest">{p}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-mist pt-4">
          <div>
            <p className="text-xs text-ink-medium">Quotation total</p>
            <p className="font-serif text-2xl text-ink">$26,050.00</p>
          </div>
          <span className="btn-primary btn-sm">Accept quote</span>
        </div>
      </div>
      <div className="rise rise-3 absolute -bottom-8 -left-4 hidden w-56 rounded-xl bg-white p-3.5 shadow-lift sm:block">
        <p className="text-[11px] uppercase tracking-wider text-ink-medium">20′ container</p>
        <div className="mt-2 h-2 rounded-full bg-mist"><div className="h-full w-[86%] rounded-full bg-success" /></div>
        <p className="mt-1.5 text-xs text-ink"><b>86%</b> full · volume-limited</p>
      </div>
      <div className="rise rise-3 absolute -right-3 -top-6 hidden items-center gap-2 rounded-xl bg-forest px-3.5 py-2.5 text-white shadow-lift sm:flex">
        <ShieldCheck className="h-4 w-4 text-gold-light" />
        <span className="text-xs">$26,050 held in escrow</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="bg-hero relative overflow-hidden text-white">
        <div className="bg-grain absolute inset-0 opacity-40" aria-hidden />
        <div className="container-x relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-2 lg:py-28">
          <div className="rise">
            <p className="font-serif text-lg italic text-gold-light">Global Sourcing · Trusted Partnerships · Timeless Value</p>
            <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl lg:text-[3.6rem]">
              Source home &amp; lifestyle products from vetted makers — <span className="italic text-gold-light">matched by hand.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Post one request. Our sourcing team routes it to the single best-fit verified manufacturer. Get a clear USD quotation, negotiate in-app, and pay through escrow that’s released only when your goods arrive.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register?role=buyer" className="btn-gold btn-lg">Post a free RFQ <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/register?role=seller" className="btn btn-lg border border-white/30 text-white hover:bg-white/10">I’m a manufacturer</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              {['No credit card to start', 'Payments secured by Stripe', 'US-based support'].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-gold-light" />{t}</span>
              ))}
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-beige bg-white">
        <div className="container-x grid grid-cols-2 gap-6 py-8 text-center md:grid-cols-4">
          {[['1 seller', 'hand-matched per RFQ'], ['100%', 'escrow-protected orders'], ['6+', 'sourcing countries'], ['24–48h', 'typical routing time']].map(([a, b]) => (
            <div key={b}>
              <p className="font-serif text-3xl text-forest">{a}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-ink-medium">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container-x py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-3xl text-forest sm:text-4xl">From request to delivery, without the noise</h2>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card card-pad relative">
              <span className="absolute right-5 top-4 font-serif text-5xl text-beige">{i + 1}</span>
              <div className="inline-flex rounded-xl bg-forest p-3 text-gold-light"><s.icon className="h-5 w-5" /></div>
              <h3 className="mt-5 text-xl text-forest">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-medium">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURES */}
      <section className="bg-white py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">Why Ranavista</p>
            <h2 className="mt-3 text-3xl text-forest sm:text-4xl">A curated marketplace, not a directory</h2>
            <p className="mt-4 text-ink-medium">Open marketplaces flood you with unvetted suppliers. Ranavista puts a sourcing team between you and the factory floor — so every quote you see is one worth reading.</p>
            <Link to="/about" className="link mt-6 inline-flex items-center gap-1">Our approach <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl2 border border-beige bg-cream/50 p-6 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft">
                <f.icon className="h-6 w-6 text-gold" />
                <h3 className="mt-4 font-sans text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-medium">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container-x py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Products</p>
            <h2 className="mt-3 text-3xl text-forest sm:text-4xl">What our makers produce</h2>
          </div>
          <Link to="/categories" className="link inline-flex items-center gap-1">All categories <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.slice(0, 8).map((c, i) => (
            <Link key={c} to={`/register?role=buyer&category=${encodeURIComponent(c)}`}
              className="group relative flex h-32 flex-col justify-end overflow-hidden rounded-xl2 p-4 text-white transition hover:-translate-y-0.5 hover:shadow-lift"
              style={{ background: ['#0D3B32', '#A47148', '#6B7F5B', '#5A7D9A', '#134a40', '#9c8155', '#8BA88E', '#1F2D2A'][i] }}>
              <LotusMark className="absolute -right-4 -top-3 h-24 w-28 opacity-20 transition group-hover:opacity-30" color="#fff" />
              <span className="relative font-serif text-lg">{c}</span>
              <span className="relative text-xs text-white/70 group-hover:text-white">Request a quote →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ + SELLER CTA */}
      <section className="bg-white py-20">
        <div className="container-x grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Questions</p>
            <h2 className="mt-3 text-3xl text-forest">Frequently asked</h2>
            <div className="mt-8 divide-y divide-mist rounded-xl2 border border-beige">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                    {q}<span className="text-gold transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-medium">{a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="bg-hero relative overflow-hidden rounded-[1.75rem] p-8 text-white sm:p-10">
            <LotusMark className="absolute -bottom-6 -right-6 h-40 w-48 opacity-15" color="#fff" />
            <Sparkles className="h-6 w-6 text-gold-light" />
            <h3 className="mt-4 text-3xl">Manufacturers: receive exclusive, pre-qualified leads</h3>
            <p className="mt-3 text-white/75">Every lead you receive is reviewed by our team and sent to you alone. No race to the bottom — just serious US buyers ready to order.</p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              {['Exclusive leads, matched to your categories', 'Get paid via Stripe Connect', 'Build your rating with every delivery'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Truck className="h-4 w-4 text-gold-light" />{t}</li>
              ))}
            </ul>
            <Link to="/register?role=seller" className="btn-gold btn-lg mt-8">Apply as a seller <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}

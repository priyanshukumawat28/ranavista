import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Facebook, Instagram, Linkedin, Mail, Menu, Phone, X, Youtube } from 'lucide-react';
import Logo from './Logo';
import { useAuth, homeFor } from '../lib/auth';
import { CATEGORIES } from '../lib/format';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/categories', label: 'Products', menu: true },
  { to: '/sourcing', label: 'Sourcing Countries' },
  { to: '/trade-fairs', label: 'Trade Fairs' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact Us' },
];

function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <header className={cx('sticky top-0 z-40 bg-forest transition-shadow', scrolled && 'shadow-lift')}>
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Logo light tagline={false} />
        <nav className="hidden items-stretch self-stretch lg:flex" aria-label="Main">
          {NAV.map((n) =>
            n.menu ? (
              <div key={n.to} className="group relative flex">
                <NavLink to={n.to} className={({ isActive }) => cx('flex items-center gap-1 px-3.5 text-[13px] text-white/85 transition hover:text-white', isActive && 'bg-gold text-white')}>
                  {n.label} <ChevronDown className="h-3.5 w-3.5" />
                </NavLink>
                <div className="invisible absolute left-0 top-full w-[440px] translate-y-1 rounded-b-xl bg-white p-3 opacity-0 shadow-lift transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="grid grid-cols-2 gap-0.5">
                    {CATEGORIES.slice(0, 14).map((c) => (
                      <Link key={c} to={`/categories#${encodeURIComponent(c)}`} className="rounded-md px-3 py-2 text-sm text-ink hover:bg-cream hover:text-forest">{c}</Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex items-center px-3.5 text-[13px] text-white/85 transition hover:text-white', isActive && 'bg-gold text-white')}>
                {n.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Link to={homeFor(user)} className="btn-gold btn-sm">Go to dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="px-3 text-[13px] text-white/85 hover:text-white">Login</Link>
              <Link to="/register" className="btn-gold btn-sm">Post an RFQ</Link>
            </>
          )}
        </div>
        <button className="rounded-md p-2 text-white lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-forest-900 lg:hidden">
          <div className="container-x flex flex-col py-3">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('rounded-md px-3 py-3 text-white/85', isActive && 'bg-white/10 text-white')}>{n.label}</NavLink>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              {user ? (
                <Link to={homeFor(user)} className="btn-gold col-span-2">Go to dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="btn border border-white/30 text-white">Login</Link>
                  <Link to="/register" className="btn-gold">Post an RFQ</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-forest text-white/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">Connecting US retailers and brands with exceptional home & lifestyle manufacturers — vetted, matched by hand, and paid through escrow.</p>
          <div className="mt-5 space-y-1.5 text-sm">
            <a href="mailto:hello@ranavista.com" className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4 text-gold" /> hello@ranavista.com</a>
            <a href="tel:+18005550199" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4 text-gold" /> +1 (800) 555-0199</a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 md:col-span-5">
          <div>
            <h4 className="mb-3 font-sans text-sm font-semibold text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[['About Us', '/about'], ['Products', '/categories'], ['Sourcing Countries', '/sourcing'], ['Trade Fairs', '/trade-fairs']].map(([l, h]) => (
                <li key={h}><Link to={h} className="hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-sans text-sm font-semibold text-white">Resources</h4>
            <ul className="space-y-2 text-sm">
              {[['Pricing', '/pricing'], ['Become a Seller', '/register?role=seller'], ['Contact Us', '/contact'], ['Privacy Policy', '/privacy'], ['Terms & Conditions', '/terms']].map(([l, h]) => (
                <li key={h}><Link to={h} className="hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="md:col-span-3 md:border-l md:border-white/15 md:pl-8">
          <h4 className="mb-3 font-sans text-sm font-semibold text-white">Follow Us</h4>
          <div className="flex gap-3">
            {[Linkedin, Facebook, Instagram, Youtube].map((I, i) => (
              <a key={i} href="#" className="rounded-lg bg-white/10 p-2.5 transition hover:bg-gold" aria-label="Social link"><I className="h-5 w-5" /></a>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/50">Payments processed securely by Stripe. All prices in USD.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-5 text-xs text-white/50 sm:flex-row">
          <span>© {new Date().getFullYear()} Ranavista. All rights reserved.</span>
          <span>Building Sustainable Partnerships Worldwide.</span>
        </div>
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

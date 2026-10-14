import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CreditCard, FilePlus2, FileText, Inbox, LayoutDashboard, LogOut, Menu, Package, Settings, Star, Wallet, X,
} from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../lib/auth';
import { Alert, cx } from './ui';

const MENUS = {
  buyer: [
    { to: '/buyer', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/buyer/rfqs/new', label: 'Post an RFQ', icon: FilePlus2 },
    { to: '/buyer/rfqs', label: 'My RFQs', icon: FileText, end: true },
    { to: '/buyer/orders', label: 'Orders', icon: Package },
    { to: '/buyer/subscription', label: 'Plan & billing', icon: CreditCard },
    { to: '/buyer/notifications', label: 'Notifications', icon: Bell },
    { to: '/buyer/settings', label: 'Settings', icon: Settings },
  ],
  seller: [
    { to: '/seller', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/seller/leads', label: 'My leads', icon: Inbox },
    { to: '/seller/orders', label: 'Orders', icon: Package },
    { to: '/seller/payouts', label: 'Payouts', icon: Wallet },
    { to: '/seller/reviews', label: 'Reviews', icon: Star },
    { to: '/seller/subscription', label: 'Plan & billing', icon: CreditCard },
    { to: '/seller/notifications', label: 'Notifications', icon: Bell },
    { to: '/seller/settings', label: 'Company profile', icon: Briefcase },
  ],
};

export default function DashboardLayout({ role }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  const menu = MENUS[role];
  const Sidebar = (
    <div className="flex h-full flex-col bg-forest text-white">
      <div className="flex h-[72px] items-center px-5"><Logo light tagline={false} /></div>
      <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
        <p className="truncate text-sm font-medium">{user.company || user.name}</p>
        <p className="text-xs capitalize text-gold-light/80">{role} account</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {menu.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition', isActive ? 'bg-gold text-white shadow-sm' : 'text-white/75 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-[18px] w-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button onClick={() => { signOut(); nav('/'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-lift">{Sidebar}</div>
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full bg-white p-2" aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-beige/70 bg-cream/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-forest hover:bg-white lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <Link to="/" className="hidden text-sm text-ink-medium hover:text-forest sm:block">← Back to website</Link>
          </div>
          <div className="flex items-center gap-2">
            {role === 'buyer' && <Link to="/buyer/rfqs/new" className="btn-gold btn-sm hidden sm:inline-flex"><FilePlus2 className="h-4 w-4" /> New RFQ</Link>}
            <NotificationBell allLink={`/${role}/notifications`} />
            <Link to={`/${role}/settings`} className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-serif text-sm text-white" title={user.name}>
              {user.name?.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {!user.emailVerified && (
            <Alert type="warning" className="mb-5">Please verify your email to {role === 'buyer' ? 'post RFQs' : 'receive leads'}. <Link to="/verify" className="link">Enter your code →</Link></Alert>
          )}
          {role === 'seller' && user.seller?.approval === 'pending' && (
            <Alert type="info" className="mb-5">Your company is under review by the Ranavista team (usually 1–2 business days). Complete your <Link to="/seller/settings" className="link">company profile</Link> and upload documents to speed it up.</Alert>
          )}
          {role === 'seller' && user.seller?.approval === 'rejected' && (
            <Alert type="error" className="mb-5">Verification needs attention: {user.seller.rejectionReason || 'please update your profile and documents.'}</Alert>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useAuth, homeFor } from './lib/auth';
import { PageLoader } from './components/ui';
import SiteLayout from './components/SiteLayout';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/public/Home';
import { About, Categories, Contact, Legal, Pricing, Sourcing, TradeFairs } from './pages/public/Pages';
import { Forgot, Login, Register, Verify } from './pages/public/Auth';
import BuyerDashboard from './pages/buyer/BuyerDashboard';
import RFQList from './pages/buyer/RFQList';
import NewRFQ from './pages/buyer/NewRFQ';
import BuyerRFQDetail from './pages/buyer/RFQDetail';
import Orders from './pages/shared/Orders';
import OrderDetail from './pages/shared/OrderDetail';
import { Notifications, Settings, Subscription } from './pages/shared/Account';
import { LeadDetail, Leads, Payouts, Reviews, SellerDashboard } from './pages/seller/SellerPages';

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to={user.emailVerified ? homeFor(user) : '/verify'} replace /> : children;
}

function NotFound() {
  return (
    <div className="container-x py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl text-forest">This page wandered off</h1>
      <Link to="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="categories" element={<Categories />} />
        <Route path="sourcing" element={<Sourcing />} />
        <Route path="trade-fairs" element={<TradeFairs />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Legal kind="privacy" />} />
        <Route path="terms" element={<Legal kind="terms" />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="forgot-password" element={<GuestOnly><Forgot /></GuestOnly>} />
      <Route path="verify" element={<Verify />} />

      <Route path="buyer" element={<RequireRole role="buyer"><DashboardLayout role="buyer" /></RequireRole>}>
        <Route index element={<BuyerDashboard />} />
        <Route path="rfqs" element={<RFQList />} />
        <Route path="rfqs/new" element={<NewRFQ />} />
        <Route path="rfqs/:id" element={<BuyerRFQDetail />} />
        <Route path="orders" element={<Orders role="buyer" />} />
        <Route path="orders/:id" element={<OrderDetail role="buyer" />} />
        <Route path="subscription" element={<Subscription role="buyer" />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings role="buyer" />} />
      </Route>

      <Route path="seller" element={<RequireRole role="seller"><DashboardLayout role="seller" /></RequireRole>}>
        <Route index element={<SellerDashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="orders" element={<Orders role="seller" />} />
        <Route path="orders/:id" element={<OrderDetail role="seller" />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="subscription" element={<Subscription role="seller" />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings role="seller" />} />
      </Route>
    </Routes>
  );
}

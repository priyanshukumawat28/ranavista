import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Alert, PageLoader } from './components/ui';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AllRfqs, Queue } from './pages/Rfqs';
import RfqDetail from './pages/RfqDetail';
import { UserDetail, UserList } from './pages/Users';
import { OrderDetail, Orders } from './pages/Orders';
import { DisputeDetail, Disputes } from './pages/Disputes';
import { Audit, Enquiries, Plans, Revenue, Reviews, Team } from './pages/Misc';

function Gate({ area, children }) {
  const { can } = useAuth();
  return can(area) ? children : <Alert type="warning">Your admin role doesn’t include this section. Ask a Super Admin for access.</Alert>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AdminLayout />}>
        <Route index element={<Gate area="overview"><Dashboard /></Gate>} />
        <Route path="queue" element={<Gate area="rfqs"><Queue /></Gate>} />
        <Route path="rfqs" element={<Gate area="rfqs"><AllRfqs /></Gate>} />
        <Route path="rfqs/:id" element={<Gate area="rfqs"><RfqDetail /></Gate>} />
        <Route path="sellers" element={<Gate area="sellers"><UserList role="seller" /></Gate>} />
        <Route path="sellers/:id" element={<Gate area="sellers"><UserDetail role="seller" /></Gate>} />
        <Route path="buyers" element={<Gate area="buyers"><UserList role="buyer" /></Gate>} />
        <Route path="buyers/:id" element={<Gate area="buyers"><UserDetail role="buyer" /></Gate>} />
        <Route path="orders" element={<Gate area="orders"><Orders /></Gate>} />
        <Route path="orders/:id" element={<Gate area="orders"><OrderDetail /></Gate>} />
        <Route path="disputes" element={<Gate area="disputes"><Disputes /></Gate>} />
        <Route path="disputes/:id" element={<Gate area="disputes"><DisputeDetail /></Gate>} />
        <Route path="plans" element={<Gate area="plans"><Plans /></Gate>} />
        <Route path="revenue" element={<Gate area="revenue"><Revenue /></Gate>} />
        <Route path="reviews" element={<Gate area="reviews"><Reviews /></Gate>} />
        <Route path="enquiries" element={<Gate area="enquiries"><Enquiries /></Gate>} />
        <Route path="audit" element={<Gate area="audit"><Audit /></Gate>} />
        <Route path="team" element={<Gate area="team"><Team /></Gate>} />
        <Route path="*" element={<Alert type="info">Page not found.</Alert>} />
      </Route>
    </Routes>
  );
}

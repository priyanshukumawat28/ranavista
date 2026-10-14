import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CreditCard, DollarSign, Gavel, Inbox, Lock, TimerOff } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { timeAgo, usd0 } from '../lib/format';
import { Card, PageHeader, PageLoader, Stat, StatusBadge } from '../components/ui';
import Bars from '../components/Bars';

const ORDER = ['pending', 'assigned', 'quoted', 'negotiating', 'accepted', 'closed', 'cancelled'];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch('/admin/overview');
  if (loading || !data) return <PageLoader />;
  const k = data.kpis;
  const totalRfqs = Object.values(data.statusCounts).reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Marketplace at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/queue"><Stat label="Unassigned RFQs" value={k.pending} icon={Inbox} tone="gold" hint="Waiting in the pending queue" /></Link>
        <Link to="/rfqs?overdue=1"><Stat label="Overdue leads" value={k.overdue} icon={TimerOff} tone="red" hint="Seller missed response window" /></Link>
        <Link to="/sellers?approval=pending"><Stat label="Sellers to verify" value={k.sellersPending} icon={Building2} tone="blue" /></Link>
        <Link to="/disputes"><Stat label="Open disputes" value={k.openDisputes} icon={Gavel} tone="red" /></Link>
        <Stat label="Funds held (escrow)" value={usd0(k.held)} icon={Lock} />
        <Stat label="Platform fees this month" value={usd0(k.monthFees)} icon={DollarSign} tone="sage" />
        <Stat label="Subscription MRR" value={usd0(k.mrr)} icon={CreditCard} tone="gold" />
        {k.overdue > 0 ? (
          <Link to="/rfqs?overdue=1" className="card card-pad flex items-center gap-3 border-danger/30 bg-danger/5 text-danger"><AlertTriangle className="h-6 w-6" /><span className="text-sm font-medium">{k.overdue} lead{k.overdue > 1 ? 's' : ''} need reassignment</span></Link>
        ) : <div className="card card-pad flex items-center text-sm text-ink-medium">All leads within response window ✓</div>}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="card-pad xl:col-span-2">
          <h2 className="mb-6 text-lg text-forest">Paid volume — last 6 months</h2>
          <Bars series={data.series.map((s) => ({ label: s.label, value: s.gmv, value2: s.fees }))} valueLabel="GMV" value2Label="Platform fees" />
        </Card>
        <Card className="card-pad">
          <h2 className="mb-4 text-lg text-forest">RFQ pipeline</h2>
          <div className="space-y-3">
            {ORDER.map((s) => (
              <div key={s}>
                <div className="mb-1 flex items-center justify-between text-sm"><StatusBadge status={s} /><span className="font-medium">{data.statusCounts[s] || 0}</span></div>
                <div className="h-1.5 rounded-full bg-mist"><div className="h-full rounded-full bg-forest" style={{ width: `${((data.statusCounts[s] || 0) / totalRfqs) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-mist px-6 py-4"><h2 className="text-lg text-forest">Latest RFQs</h2><Link to="/rfqs" className="text-sm font-medium text-forest hover:underline">View all</Link></div>
        <table className="table">
          <tbody>
            {data.recentRfqs.map((r) => (
              <tr key={r._id}>
                <td><Link to={`/rfqs/${r._id}`} className="font-medium text-forest hover:underline">{r.number}</Link></td>
                <td className="max-w-xs truncate">{r.title}</td>
                <td className="text-ink-medium">{r.buyer?.company || r.buyer?.name}</td>
                <td className="text-ink-medium">{r.category}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-right text-xs text-ink-medium">{timeAgo(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

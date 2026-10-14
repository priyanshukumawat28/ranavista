import { Link } from 'react-router-dom';
import { ArrowRight, DollarSign, FilePlus2, FileText, MessageSquareQuote, Package } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../lib/auth';
import { date, usd0 } from '../../lib/format';
import { Card, Empty, PageHeader, PageLoader, Stat, StatusBadge } from '../../components/ui';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch('/dashboard');
  const { data: rfqs } = useFetch('/rfqs');
  if (loading || !data) return <PageLoader />;
  const { stats, plan } = data;
  const limit = plan?.limits?.rfqsPerMonth;
  const pct = limit > 0 ? Math.min(100, (stats.usedThisMonth / limit) * 100) : 0;

  return (
    <>
      <PageHeader title={`Good to see you, ${user.name.split(' ')[0]}`} subtitle="Here’s what’s happening with your sourcing."
        actions={<Link to="/buyer/rfqs/new" className="btn-gold"><FilePlus2 className="h-4 w-4" /> Post an RFQ</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open RFQs" value={stats.open} icon={FileText} />
        <Stat label="Quotes to review" value={stats.quotesWaiting} icon={MessageSquareQuote} tone="gold" hint={stats.quotesWaiting ? 'Waiting for your decision' : undefined} />
        <Stat label="Active orders" value={stats.activeOrders} icon={Package} tone="blue" />
        <Stat label="Total sourced" value={usd0(stats.spent)} icon={DollarSign} tone="sage" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-mist px-6 py-4">
            <h2 className="text-lg text-forest">Recent RFQs</h2>
            <Link to="/buyer/rfqs" className="link text-sm">View all</Link>
          </div>
          {!rfqs?.length ? (
            <Empty icon={FileText} title="No RFQs yet" text="Post your first request and our team will match it with a verified manufacturer." action={<Link to="/buyer/rfqs/new" className="btn-primary">Post an RFQ</Link>} />
          ) : (
            <ul className="divide-y divide-mist">
              {rfqs.slice(0, 6).map((r) => (
                <li key={r._id}>
                  <Link to={`/buyer/rfqs/${r._id}`} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-cream/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{r.title}</p>
                      <p className="text-xs text-ink-medium">{r.number} · {r.category} · due {date(r.deadline)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="card-pad">
          <p className="eyebrow">Your plan</p>
          <h3 className="mt-2 text-2xl text-forest">{plan?.name}</h3>
          {limit === -1 ? <p className="mt-3 text-sm text-ink-medium">Unlimited RFQs this month.</p> : (
            <>
              <p className="mt-3 text-sm text-ink-medium">{stats.usedThisMonth} of {limit} RFQs used this month</p>
              <div className="mt-2 h-2 rounded-full bg-mist"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
            </>
          )}
          <Link to="/buyer/subscription" className="btn-outline mt-5 w-full">Manage plan <ArrowRight className="h-4 w-4" /></Link>
          <div className="mt-6 rounded-xl bg-cream p-4 text-sm text-ink-medium">
            <p className="font-medium text-forest">Tip</p>
            Add carton size and weight to each item — the container planner will show how full your shipment is and where you can save on freight.
          </div>
        </Card>
      </div>
    </>
  );
}

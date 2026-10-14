import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, Lock, Search, Timer } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { CATEGORIES, date, num, timeAgo, timeLeft } from '../lib/format';
import { Card, Empty, Input, PageHeader, PageLoader, Select, StatusBadge, Tabs, cx } from '../components/ui';

/** Pending queue (oldest first) — the starting point of every lead. */
export function Queue() {
  const { data, loading } = useFetch('/admin/rfqs?status=pending');
  return (
    <>
      <PageHeader title="Pending RFQ queue" subtitle="Every new RFQ lands here as Unassigned. Review it and push it to exactly one seller." />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.length ? <Empty icon={Inbox} title="Queue is clear" text="New RFQs will appear here the moment buyers post them." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Waiting</th><th>RFQ</th><th>Buyer</th><th>Category</th><th className="text-right">Units</th><th>Deadline</th><th></th></tr></thead>
              <tbody>
                {data.map((r) => {
                  const hrs = (Date.now() - new Date(r.createdAt)) / 36e5;
                  return (
                    <tr key={r._id}>
                      <td><span className={cx('inline-flex items-center gap-1 text-xs font-medium', hrs > 24 ? 'text-danger' : hrs > 8 ? 'text-gold-dark' : 'text-ink-medium')}><Timer className="h-3.5 w-3.5" />{timeAgo(r.createdAt)}</span></td>
                      <td><Link to={`/rfqs/${r._id}`} className="font-medium text-forest hover:underline">{r.title}</Link><span className="block text-xs text-ink-medium">{r.number}</span></td>
                      <td>{r.buyer?.company || r.buyer?.name}<span className="block text-xs capitalize text-ink-medium">{(r.buyer?.subscription?.plan || 'basic').replace('buyer_', '')} plan</span></td>
                      <td>{r.category}</td>
                      <td className="text-right">{num(r.items.reduce((s, i) => s + i.quantity, 0))}</td>
                      <td className="whitespace-nowrap">{date(r.deadline)}</td>
                      <td className="text-right">
                        {r.lockedBy && new Date(r.lockedUntil) > Date.now() ? <span className="inline-flex items-center gap-1 text-xs text-ink-medium"><Lock className="h-3 w-3" />{r.lockedBy.name}</span>
                          : <Link to={`/rfqs/${r._id}`} className="btn-primary btn-sm">Assign</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function AllRfqs() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const status = sp.get('status') || '';
  const category = sp.get('category') || '';
  const overdue = sp.get('overdue') || '';
  const qs = new URLSearchParams({ ...(status && { status }), ...(category && { category }), ...(overdue && { overdue }), ...(sp.get('q') && { q: sp.get('q') }) }).toString();
  const { data, loading } = useFetch(`/admin/rfqs?${qs}`);
  const setParam = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'overdue') n.delete('overdue'); setSp(n); };

  return (
    <>
      <PageHeader title="All RFQs" />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={overdue ? 'overdue' : status} onChange={(v) => (v === 'overdue' ? setSp({ overdue: '1' }) : setParam('status', v))} tabs={[
          { value: '', label: 'All' }, { value: 'pending', label: 'Unassigned' }, { value: 'assigned', label: 'With seller' }, { value: 'overdue', label: 'Overdue' },
          { value: 'quoted,negotiating', label: 'Quoted' }, { value: 'accepted', label: 'Accepted' }, { value: 'closed,cancelled', label: 'Closed' },
        ]} />
        <div className="flex flex-1 gap-2 lg:justify-end">
          <Select className="lg:w-48" value={category} onChange={(e) => setParam('category', e.target.value)} options={CATEGORIES} placeholder="All categories" />
          <form onSubmit={(e) => { e.preventDefault(); setParam('q', q); }} className="relative lg:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-medium" /><Input className="pl-9" placeholder="Number or title" value={q} onChange={(e) => setQ(e.target.value)} /></form>
        </div>
      </div>
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.length ? <Empty icon={Inbox} title="No RFQs match" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>RFQ</th><th>Buyer</th><th>Category</th><th>Assigned seller</th><th>Response due</th><th>Status</th><th>Posted</th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r._id}>
                    <td><Link to={`/rfqs/${r._id}`} className="font-medium text-forest hover:underline">{r.number}</Link><span className="block max-w-[220px] truncate text-xs text-ink-medium">{r.title}</span></td>
                    <td>{r.buyer?.company || r.buyer?.name}</td>
                    <td>{r.category}</td>
                    <td>{r.assignedSeller?.company || <span className="text-ink-medium">—</span>}</td>
                    <td>{r.status === 'assigned' && r.responseDueAt ? <span className={cx('text-xs font-medium', new Date(r.responseDueAt) < Date.now() ? 'text-danger' : 'text-ink-medium')}>{timeLeft(r.responseDueAt)}</span> : '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap text-ink-medium">{date(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

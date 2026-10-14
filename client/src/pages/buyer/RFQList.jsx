import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, FileText, Search } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { date, num } from '../../lib/format';
import { Card, Empty, Input, PageHeader, PageLoader, StatusBadge, Tabs } from '../../components/ui';

const GROUPS = {
  all: null,
  review: ['pending', 'assigned'],
  quotes: ['quoted', 'negotiating'],
  done: ['accepted', 'closed', 'cancelled'],
};

export default function RFQList() {
  const { data, loading } = useFetch('/rfqs');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => (data || []).filter((r) => (!GROUPS[tab] || GROUPS[tab].includes(r.status)) && (!q || `${r.title} ${r.number}`.toLowerCase().includes(q.toLowerCase()))), [data, tab, q]);
  const count = (g) => (data || []).filter((r) => !GROUPS[g] || GROUPS[g].includes(r.status)).length;

  return (
    <>
      <PageHeader title="My RFQs" subtitle="Every request is reviewed by our team and sent to one verified seller."
        actions={<Link to="/buyer/rfqs/new" className="btn-gold"><FilePlus2 className="h-4 w-4" /> New RFQ</Link>} />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'All', count: count('all') }, { value: 'review', label: 'In review', count: count('review') },
          { value: 'quotes', label: 'Quotes', count: count('quotes') }, { value: 'done', label: 'Closed', count: count('done') },
        ]} />
        <div className="relative md:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-medium" /><Input className="pl-9" placeholder="Search RFQs" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !list.length ? (
          <Empty icon={FileText} title="Nothing here yet" text="Post an RFQ to get a quotation from a verified manufacturer." action={<Link to="/buyer/rfqs/new" className="btn-primary">Post an RFQ</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>RFQ</th><th>Category</th><th className="text-right">Items</th><th>Deadline</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id}>
                    <td><Link to={`/buyer/rfqs/${r._id}`} className="block"><span className="font-medium text-forest hover:underline">{r.title}</span><span className="block text-xs text-ink-medium">{r.number} · posted {date(r.createdAt)}</span></Link></td>
                    <td className="text-ink-medium">{r.category}</td>
                    <td className="text-right">{num(r.items.reduce((s, i) => s + i.quantity, 0))} <span className="text-xs text-ink-medium">units</span></td>
                    <td className="whitespace-nowrap">{date(r.deadline)}</td>
                    <td><StatusBadge status={r.status} /></td>
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { date, usd } from '../../lib/format';
import { Card, Empty, PageHeader, PageLoader, StatusBadge, Tabs } from '../../components/ui';

export default function Orders({ role }) {
  const { data, loading } = useFetch('/orders');
  const [tab, setTab] = useState('all');
  const groups = { all: null, active: ['unpaid', 'held', 'disputed'], done: ['released', 'refunded', 'chargeback'] };
  const list = (data || []).filter((o) => !groups[tab] || groups[tab].includes(o.paymentStatus));
  const other = role === 'seller' ? 'buyer' : 'seller';
  return (
    <>
      <PageHeader title="Orders" subtitle={role === 'buyer' ? 'Payments are held securely until you confirm delivery.' : 'Funds are released to you once the buyer confirms delivery.'} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All', count: data?.length || 0 }, { value: 'active', label: 'Active' }, { value: 'done', label: 'Completed' }]} />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !list.length ? (
          <Empty icon={Package} title="No orders yet" text={role === 'buyer' ? 'Orders appear here when you accept a quotation.' : 'Orders appear here when a buyer accepts your quote.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th className="capitalize">{other}</th><th className="text-right">{role === 'seller' ? 'Your payout' : 'Total'}</th><th>Payment</th><th>Fulfillment</th><th>Date</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o._id}>
                    <td><Link to={`/${role}/orders/${o._id}`} className="font-medium text-forest hover:underline">{o.number}</Link><span className="block text-xs text-ink-medium">{o.rfq?.title}</span></td>
                    <td>{o[other]?.company || o[other]?.name || '—'}</td>
                    <td className="text-right font-medium">{usd(role === 'seller' ? o.sellerPayout : o.total)}</td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td><StatusBadge status={o.fulfillment} /></td>
                    <td className="whitespace-nowrap text-ink-medium">{date(o.createdAt)}</td>
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

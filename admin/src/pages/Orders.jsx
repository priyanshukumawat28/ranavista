import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Receipt, Search, Undo2, Wallet } from 'lucide-react';
import api, { download, errMsg } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { date, dateTime, usd } from '../lib/format';
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, StatusBadge, Tabs, Textarea } from '../components/ui';

/* ---------- Transaction control center ---------- */
export function Orders() {
  const { can } = useAuth();
  const [view, setView] = useState('orders');
  return (
    <>
      <PageHeader title="Transactions" subtitle="Every order, every dollar held, released or refunded." />
      <Tabs value={view} onChange={setView} tabs={[
        { value: 'orders', label: 'All orders' },
        ...(can('money') ? [{ value: 'buyer', label: 'Buyer ledger' }, { value: 'seller', label: 'Seller ledger' }, { value: 'chargebacks', label: 'Chargebacks' }] : []),
      ]} />
      {view === 'orders' && <OrderTable />}
      {(view === 'buyer' || view === 'seller') && <Ledger role={view} />}
      {view === 'chargebacks' && <Chargebacks />}
    </>
  );
}

function OrderTable() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading } = useFetch(`/admin/orders?${new URLSearchParams({ ...(status && { paymentStatus: status }), ...(search && { q: search }) })}`);
  const t = (k) => data?.totals.find((x) => x._id === k) || { total: 0, n: 0, fees: 0 };
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[['held', 'In escrow'], ['released', 'Released'], ['refunded', 'Refunded'], ['disputed', 'Disputed']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(status === k ? '' : k)} className={`card card-pad text-left transition ${status === k ? 'ring-2 ring-gold' : ''}`}>
            <p className="text-xs uppercase tracking-wider text-ink-medium">{l}</p>
            <p className="mt-1 font-serif text-2xl">{usd(t(k).total, 0)}</p>
            <p className="text-xs text-ink-medium">{t(k).n} orders{k === 'released' && ` · ${usd(t(k).fees, 0)} fees`}</p>
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q); }} className="relative mb-4 max-w-xs"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-medium" /><Input className="pl-9" placeholder="Order number" value={q} onChange={(e) => setQ(e.target.value)} /></form>
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.list.length ? <Empty icon={Receipt} title="No orders" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Buyer</th><th>Seller</th><th className="text-right">Total</th><th className="text-right">Fee</th><th>Payment</th><th>Fulfillment</th><th>Created</th></tr></thead>
              <tbody>{data.list.map((o) => (
                <tr key={o._id}>
                  <td><Link to={`/orders/${o._id}`} className="font-medium text-forest hover:underline">{o.number}</Link><span className="block text-xs text-ink-medium">{o.rfq?.number}</span></td>
                  <td>{o.buyer?.company || o.buyer?.name}</td><td>{o.seller?.company || o.seller?.name}</td>
                  <td className="text-right font-medium">{usd(o.total)}</td><td className="text-right text-ink-medium">{usd(o.platformFee)}</td>
                  <td><StatusBadge status={o.paymentStatus} /></td><td><StatusBadge status={o.fulfillment} /></td>
                  <td className="whitespace-nowrap text-ink-medium">{date(o.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Ledger({ role }) {
  const { data, loading } = useFetch(`/admin/ledgers/${role}`);
  return (
    <Card className="overflow-hidden">
      {loading ? <PageLoader /> : !data?.length ? <Empty icon={Wallet} title="No transactions yet" /> : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th className="capitalize">{role}</th><th className="text-right">Orders</th><th className="text-right">{role === 'buyer' ? 'Paid in' : 'Gross payout'}</th><th className="text-right">Held</th><th className="text-right">Released</th><th className="text-right">Refunded</th><th className="text-right">Fees</th><th>Last order</th></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r._id}>
                <td><Link to={`/${role}s/${r._id}`} className="font-medium text-forest hover:underline">{r.company || r.name}</Link><span className="block text-xs text-ink-medium">{r.email}</span></td>
                <td className="text-right">{r.orders}</td><td className="text-right font-medium">{usd(r.paid)}</td><td className="text-right">{usd(r.held)}</td>
                <td className="text-right">{usd(r.released)}</td><td className="text-right">{usd(r.refunded)}</td><td className="text-right text-ink-medium">{usd(r.fees)}</td>
                <td className="text-ink-medium">{date(r.last)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Chargebacks() {
  const { data, loading } = useFetch('/admin/chargebacks');
  return (
    <Card className="overflow-hidden">
      {loading ? <PageLoader /> : !data?.length ? <Empty icon={Receipt} title="No chargebacks 🎉" text="Card disputes from Stripe appear here. Respond to them in your Stripe dashboard before the deadline." /> : (
        <table className="table"><tbody>{data.map((o) => <tr key={o._id}><td><Link to={`/orders/${o._id}`} className="font-medium text-forest">{o.number}</Link></td><td>{o.buyer?.company}</td><td>{o.seller?.company}</td><td className="text-right">{usd(o.total)}</td><td>{date(o.updatedAt)}</td></tr>)}</tbody></table>
      )}
    </Card>
  );
}

/* ---------- Single order with manual escrow controls ---------- */
export function OrderDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/admin/orders/${id}`);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { order: o, disputes } = data;
  const holding = ['held', 'disputed'].includes(o.paymentStatus);
  const act = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setModal(null); setForm({}); setMsg({ type: 'success', t: ok }); await reload(); } catch (x) { setMsg({ type: 'error', t: errMsg(x) }); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader back={<Link to="/orders" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> Transactions</Link>}
        title={`Order ${o.number}`} subtitle={<span className="flex flex-wrap gap-2"><StatusBadge status={o.paymentStatus} /><StatusBadge status={o.fulfillment} /> <Link to={`/rfqs/${o.rfq?._id}`} className="text-forest hover:underline">{o.rfq?.number}</Link></span>}
        actions={<>
          {o.paymentStatus !== 'unpaid' && <Button variant="outline" onClick={() => download(`/orders/${id}/invoice`, `Invoice-${o.number}.pdf`).catch((x) => setMsg({ type: 'error', t: errMsg(x) }))}><Download className="h-4 w-4" /> Invoice</Button>}
          {holding && can('money') && <Button onClick={() => setModal('release')}><Wallet className="h-4 w-4" /> Release to seller</Button>}
          {holding && can('money') && <Button variant="danger" onClick={() => { setForm({ amount: '' }); setModal('refund'); }}><Undo2 className="h-4 w-4" /> Refund</Button>}
        </>} />
      {msg && <Alert type={msg.type} className="mb-5">{msg.t}</Alert>}
      {disputes.some((d) => ['open', 'under_review'].includes(d.status)) && <Alert type="warning" className="mb-5">This order has an open dispute. <Link to={`/disputes/${disputes[0]._id}`} className="font-medium underline">Open dispute workspace →</Link></Alert>}
      {holding && !o.seller?.seller?.payoutsEnabled && <Alert type="info" className="mb-5">Seller hasn’t finished Stripe payout setup — releasing will fail until they do (demo mode excepted).</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {[['Order total', o.total], ['Platform fee', o.platformFee], ['Seller payout', o.sellerPayout], ['Shipping', o.shippingCost]].map(([l, v]) => (
              <div key={l} className="card card-pad"><p className="text-xs uppercase tracking-wider text-ink-medium">{l}</p><p className="mt-1 font-serif text-xl">{usd(v)}</p></div>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Money ledger</h3></div>
            <table className="table">
              <thead><tr><th>When</th><th>Type</th><th className="text-right">Amount</th><th>Note</th><th>By</th></tr></thead>
              <tbody>{[...o.ledger].reverse().map((l, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-ink-medium">{dateTime(l.at)}</td>
                  <td><Badge color={{ charge: 'blue', hold: 'gold', release: 'success', refund: 'red', fee: 'green', chargeback: 'red', note: 'gray' }[l.type]}>{l.type}</Badge></td>
                  <td className="text-right font-medium">{l.amount != null ? usd(l.amount) : ''}</td>
                  <td className="text-sm">{l.note}{l.ref && <span className="block font-mono text-[10px] text-ink-medium">{l.ref}</span>}</td>
                  <td className="text-ink-medium">{l.by?.name || 'system'}</td>
                </tr>
              ))}</tbody>
            </table>
            <form onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/admin/orders/${id}/note`, { note: form.note }), 'Note added.'); }} className="flex gap-2 border-t border-mist p-4">
              <Input value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Add an internal ledger note" />
              <Button variant="outline" disabled={!form.note}>Add</Button>
            </form>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Items</h3></div>
            <table className="table"><tbody>{o.lines.map((l, i) => <tr key={i}><td>{l.name}</td><td className="text-right">{l.quantity} {l.unit}</td><td className="text-right">{usd(l.unitPrice)}</td><td className="text-right font-medium">{usd(l.unitPrice * l.quantity)}</td></tr>)}</tbody></table>
          </Card>
        </div>
        <div className="space-y-6">
          {[['Buyer', o.buyer, 'buyers'], ['Seller', o.seller, 'sellers']].map(([l, u, path]) => (
            <Card key={l} className="card-pad text-sm">
              <p className="eyebrow">{l}</p>
              <Link to={`/${path}/${u._id}`} className="mt-1 block font-serif text-lg text-forest hover:underline">{u.company || u.name}</Link>
              <p className="text-ink-medium">{u.name} · {u.email}</p>
              {path === 'sellers' && <p className="mt-1 text-xs">{u.seller?.payoutsEnabled ? '✓ Payouts connected' : 'Payouts not connected'}</p>}
            </Card>
          ))}
          <Card className="card-pad space-y-1 text-sm">
            <p className="eyebrow">Timeline</p>
            {[['Created', o.createdAt], ['Paid', o.paidAt], ['Shipped', o.shippedAt], ['Delivered', o.deliveredAt], ['Released', o.releasedAt], ['Refunded', o.refundedAt]].filter(([, d]) => d).map(([l, d]) => <p key={l}><span className="inline-block w-20 text-ink-medium">{l}</span>{dateTime(d)}</p>)}
            {o.tracking?.carrier && <p className="pt-2"><span className="text-ink-medium">Tracking:</span> {o.tracking.carrier} {o.tracking.number}</p>}
            {o.stripePaymentIntentId && <p className="pt-2 font-mono text-[10px] text-ink-medium">PI: {o.stripePaymentIntentId}</p>}
          </Card>
        </div>
      </div>

      <Modal open={modal === 'release'} onClose={() => setModal(null)} title="Release funds to seller"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => act(() => api.post(`/admin/orders/${id}/release`, { note: form.note }), 'Funds released.')}>Release {usd(o.sellerPayout)}</Button></>}>
        <p className="mb-3 text-sm text-ink-medium">Transfers {usd(o.sellerPayout)} to {o.seller.company}. Ranavista keeps {usd(o.platformFee)}. This can’t be undone.</p>
        <Field label="Reason (audit log)"><Textarea rows={2} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </Modal>
      <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Refund buyer"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => act(() => api.post(`/admin/orders/${id}/refund`, { amount: form.amount || undefined, note: form.note }), 'Refund issued.')}>Issue refund</Button></>}>
        <p className="mb-3 text-sm text-ink-medium">Leave amount empty for a full refund of {usd(o.total)}. A partial refund releases the remainder to the seller.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (USD)"><Input type="number" step="0.01" min="0" max={o.total} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={`Full: ${o.total}`} /></Field>
          <Field label="Reason" className="sm:col-span-2"><Textarea rows={2} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}

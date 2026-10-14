import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, EyeOff, Gavel, MessageSquare } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { date, dateTime, usd } from '../lib/format';
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHeader, PageLoader, StatusBadge, Tabs, Textarea, cx } from '../components/ui';

const REASON = { not_received: 'Not received', not_as_described: 'Not as described', damaged: 'Damaged', quantity_short: 'Quantity short', late: 'Late', other: 'Other' };
const DS = { open: ['red', 'Open'], under_review: ['amber', 'Under review'], resolved_refund: ['gray', 'Refunded'], resolved_release: ['success', 'Released'], resolved_partial: ['blue', 'Partial'], closed: ['gray', 'Closed'] };
const DBadge = ({ s }) => <Badge color={DS[s]?.[0]}>{DS[s]?.[1]}</Badge>;

export function Disputes() {
  const [tab, setTab] = useState('open,under_review');
  const { data, loading } = useFetch(`/admin/disputes?status=${tab}`);
  return (
    <>
      <PageHeader title="Disputes" subtitle="Funds stay frozen until a resolution is recorded here." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open,under_review', label: 'Active' }, { value: 'resolved_refund,resolved_release,resolved_partial,closed', label: 'Resolved' }]} />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.length ? <Empty icon={Gavel} title="No disputes here" /> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Opened by</th><th>Reason</th><th className="text-right">At stake</th><th>Owner</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>{data.map((d) => (
              <tr key={d._id}>
                <td><Link to={`/disputes/${d._id}`} className="font-medium text-forest hover:underline">{d.order?.number}</Link><span className="block text-xs text-ink-medium">{d.order?.buyer?.company} ↔ {d.order?.seller?.company}</span></td>
                <td className="capitalize">{d.openedBy?.role} · {d.openedBy?.name}</td>
                <td>{REASON[d.reason]}</td>
                <td className="text-right font-medium">{usd(d.order?.total)}</td>
                <td>{d.assignedTo?.name || <span className="text-ink-medium">Unassigned</span>}</td>
                <td><DBadge s={d.status} /></td>
                <td className="text-ink-medium">{date(d.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export function DisputeDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/admin/disputes/${id}`);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [res, setRes] = useState({ outcome: '', amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { dispute: d, messages } = data;
  const o = d.order;
  const active = ['open', 'under_review'].includes(d.status);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post(`/admin/disputes/${id}/message`, { text, internal }); setText(''); await reload(); } catch (x) { setMsg({ type: 'error', t: errMsg(x) }); } finally { setBusy(false); }
  };
  const resolve = async () => {
    setBusy(true); setMsg(null);
    try { await api.post(`/admin/disputes/${id}/resolve`, res); setMsg({ type: 'success', t: 'Dispute resolved and money moved.' }); await reload(); } catch (x) { setMsg({ type: 'error', t: errMsg(x) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader back={<Link to="/disputes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> Disputes</Link>}
        title={`Dispute — ${o.number}`} subtitle={<span className="flex flex-wrap items-center gap-2">{REASON[d.reason]} · opened by {d.openedBy?.role} {d.openedBy?.name} on {date(d.createdAt)} <DBadge s={d.status} /></span>}
        actions={<Link to={`/orders/${o._id}`} className="btn-outline">Open order ledger</Link>} />
      {msg && <Alert type={msg.type} className="mb-5">{msg.t}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Case thread</h3><p className="text-xs text-ink-medium">Buyer and seller see public replies. Internal notes are admin-only.</p></div>
            <div className="max-h-[520px] space-y-3 overflow-y-auto p-5">
              {d.thread.map((t, i) => (
                <div key={i} className={cx('rounded-xl px-4 py-3 text-sm', t.internal ? 'border border-dashed border-warning bg-warning/10' : t.role === 'admin' ? 'bg-forest/5 ring-1 ring-forest/10' : t.role === 'buyer' ? 'bg-muted/10' : 'bg-cream')}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-medium">{t.internal && <EyeOff className="h-3 w-3" />}<b className="capitalize text-ink">{t.role}</b> · {t.by?.name} · {dateTime(t.at)}{t.internal && ' · internal'}</p>
                  <p className="whitespace-pre-line">{t.text}</p>
                </div>
              ))}
            </div>
            {active && (
              <form onSubmit={send} className="space-y-2 border-t border-mist p-4">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={internal ? 'Internal note (not visible to buyer/seller)' : 'Reply to both parties'} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-forest" /> Internal note</label>
                  <Button disabled={!text.trim()} loading={busy}>{internal ? 'Save note' : 'Send reply'}</Button>
                </div>
              </form>
            )}
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-mist px-6 py-3"><MessageSquare className="h-4 w-4 text-gold" /><h3 className="text-lg text-forest">Original buyer–seller chat</h3></div>
            <div className="max-h-80 space-y-2 overflow-y-auto bg-cream/40 p-4">
              {!messages.length && <p className="text-center text-sm text-ink-medium">No chat history.</p>}
              {messages.map((m) => <div key={m._id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-beige"><p className="text-[11px] text-ink-medium"><b className="capitalize">{m.sender?.role}</b> · {dateTime(m.createdAt)}</p><p className="whitespace-pre-wrap">{m.text}</p></div>)}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="card-pad text-sm">
            <p className="eyebrow">Order</p>
            <p className="mt-2 font-serif text-3xl">{usd(o.total)}</p>
            <div className="mt-3 flex gap-2"><StatusBadge status={o.paymentStatus} /><StatusBadge status={o.fulfillment} /></div>
            <div className="mt-4 space-y-1">
              <p><span className="text-ink-medium">Buyer:</span> <Link to={`/buyers/${o.buyer._id}`} className="text-forest hover:underline">{o.buyer.company || o.buyer.name}</Link></p>
              <p><span className="text-ink-medium">Seller:</span> <Link to={`/sellers/${o.seller._id}`} className="text-forest hover:underline">{o.seller.company || o.seller.name}</Link></p>
              <p><span className="text-ink-medium">Paid:</span> {date(o.paidAt)} · <span className="text-ink-medium">Shipped:</span> {date(o.shippedAt)}</p>
              {o.tracking?.carrier && <p><span className="text-ink-medium">Tracking:</span> {o.tracking.carrier} {o.tracking.number}</p>}
            </div>
          </Card>
          {active ? (
            <Card className="card-pad">
              <h3 className="text-lg text-forest">Resolve</h3>
              {!can('resolve') && <Alert type="info" className="mt-3">Only Finance or Super Admins can move money. Leave an internal note with your recommendation.</Alert>}
              <div className="mt-4 space-y-2">
                {[['refund', 'Full refund to buyer', usd(o.total)], ['release', 'Release to seller', usd(o.sellerPayout)], ['partial', 'Partial refund', 'rest to seller']].map(([v, l, s]) => (
                  <label key={v} className={cx('flex cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm', res.outcome === v ? 'border-forest bg-forest/5' : 'border-line')}>
                    <span className="flex items-center gap-2"><input type="radio" name="o" checked={res.outcome === v} onChange={() => setRes({ ...res, outcome: v })} className="accent-forest" />{l}</span><span className="text-xs text-ink-medium">{s}</span>
                  </label>
                ))}
              </div>
              {res.outcome === 'partial' && <Field label="Refund amount (USD)" className="mt-3"><Input type="number" min="0" step="0.01" max={o.total} value={res.amount} onChange={(e) => setRes({ ...res, amount: e.target.value })} /></Field>}
              <Field label="Resolution note (shared)" className="mt-3"><Textarea rows={3} value={res.note} onChange={(e) => setRes({ ...res, note: e.target.value })} /></Field>
              <Button className="mt-4 w-full" variant={res.outcome === 'refund' ? 'danger' : 'primary'} disabled={!res.outcome || !can('resolve')} loading={busy} onClick={resolve}>Apply resolution</Button>
            </Card>
          ) : (
            <Card className="card-pad text-sm">
              <p className="eyebrow">Resolution</p>
              <p className="mt-2">{d.resolution?.note || '—'}</p>
              <p className="mt-2 text-xs text-ink-medium">by {d.resolution?.by?.name} · {dateTime(d.resolution?.at)}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

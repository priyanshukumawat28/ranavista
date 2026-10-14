import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, Download, Factory, PackageCheck, ShieldCheck, Star, Truck, Wallet } from 'lucide-react';
import api, { download, errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { date, dateTime, num, usd } from '../../lib/format';
import { Alert, Button, Card, Field, Input, Modal, PageHeader, PageLoader, Select, Stars, StatusBadge, Textarea, cx } from '../../components/ui';
import ContainerFill from '../../components/ContainerFill';

const REASONS = [
  { value: 'not_received', label: 'Goods not received' }, { value: 'not_as_described', label: 'Not as described / quality issue' },
  { value: 'damaged', label: 'Arrived damaged' }, { value: 'quantity_short', label: 'Quantity short' }, { value: 'late', label: 'Seriously late' }, { value: 'other', label: 'Other' },
];

function Tracker({ order }) {
  const steps = [
    { label: 'Quote accepted', icon: CheckCircle2, at: order.createdAt, done: true },
    { label: 'Payment held', icon: ShieldCheck, at: order.paidAt, done: !!order.paidAt },
    { label: 'Shipped', icon: Truck, at: order.shippedAt, done: !!order.shippedAt },
    { label: 'Delivered', icon: PackageCheck, at: order.deliveredAt, done: !!order.deliveredAt },
    { label: order.paymentStatus === 'refunded' ? 'Refunded' : 'Funds released', icon: Wallet, at: order.releasedAt || order.refundedAt, done: !!(order.releasedAt || order.refundedAt) },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <Card className="card-pad">
      <ol className="relative grid gap-5 sm:grid-cols-5 sm:gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-center gap-3 sm:flex-col sm:text-center">
            {i < steps.length - 1 && <span className={cx('absolute left-[18px] top-9 h-[calc(100%-4px)] w-0.5 sm:left-[calc(50%+22px)] sm:top-[18px] sm:h-0.5 sm:w-[calc(100%-44px)]', s.done ? 'bg-success' : 'bg-mist')} />}
            <span className={cx('relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.done ? 'bg-success text-white' : i === current ? 'bg-gold text-white ring-4 ring-gold/20' : 'bg-mist text-ink-medium')}><s.icon className="h-4 w-4" /></span>
            <div><p className={cx('text-sm font-medium', s.done || i === current ? 'text-ink' : 'text-ink-medium')}>{s.label}</p><p className="text-[11px] text-ink-medium">{s.at ? date(s.at) : ''}</p></div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function OrderDetail({ role }) {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data, loading, error, reload } = useFetch(`/orders/${id}`);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  // Returning from Stripe Checkout
  useEffect(() => {
    const sid = sp.get('paid');
    if (sid && role === 'buyer') {
      api.post(`/orders/${id}/verify-payment`, { sessionId: sid }).then(() => { setSp({}); reload(); }).catch(() => {});
    }
  }, [sp, id, role, reload, setSp]);

  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { order, dispute, reviews } = data;
  const isBuyer = role === 'buyer';
  const other = isBuyer ? order.seller : order.buyer;
  const myReview = reviews.find((r) => r.fromRole === role);
  const theirReview = reviews.find((r) => r.fromRole !== role);
  const canReview = !myReview && (['released', 'refunded'].includes(order.paymentStatus) || order.fulfillment === 'delivered');

  const run = async (fn, keepOpen) => {
    setBusy(true);
    setErr('');
    try { await fn(); if (!keepOpen) setModal(null); setForm({}); await reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const pay = () => run(async () => {
    const { data: d } = await api.post(`/orders/${id}/pay`);
    if (d.url) window.location.href = d.url;
  });

  return (
    <>
      <PageHeader back={<Link to={`/${role}/orders`} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> Orders</Link>}
        title={`Order ${order.number}`}
        subtitle={<span className="flex flex-wrap items-center gap-2">{order.rfq?.title} <StatusBadge status={order.paymentStatus} /> <StatusBadge status={order.fulfillment} /></span>}
        actions={order.paymentStatus !== 'unpaid' && <Button variant="outline" onClick={() => download(`/orders/${id}/invoice`, `Ranavista-Invoice-${order.number}.pdf`).catch((x) => setErr(errMsg(x)))}><Download className="h-4 w-4" /> Invoice (PDF)</Button>}
      />
      {err && !modal && <Alert type="error" className="mb-5">{err}</Alert>}
      <Tracker order={order} />

      {/* Next-action banner */}
      <div className="mt-6">
        {isBuyer && order.paymentStatus === 'unpaid' && (
          <Card className="card-pad flex flex-col items-start justify-between gap-4 border-gold/40 bg-gold/5 sm:flex-row sm:items-center">
            <div className="flex gap-3"><CreditCard className="mt-1 h-5 w-5 text-gold-dark" /><div><p className="font-medium text-ink">Complete payment to start production</p><p className="text-sm text-ink-medium">Pay by card, ACH bank transfer, Apple Pay or Google Pay. Ranavista holds your money until you confirm delivery.</p></div></div>
            <Button size="lg" loading={busy} onClick={pay}>Pay {usd(order.total)} securely</Button>
          </Card>
        )}
        {!isBuyer && order.paymentStatus === 'unpaid' && <Alert type="info">Waiting for the buyer to pay. You’ll be notified as soon as funds are secured — don’t start production before that.</Alert>}
        {!isBuyer && order.paymentStatus === 'held' && order.fulfillment === 'processing' && (
          <Card className="card-pad flex flex-col items-start justify-between gap-4 border-success/30 bg-success/5 sm:flex-row sm:items-center">
            <div className="flex gap-3"><Factory className="mt-1 h-5 w-5 text-success" /><div><p className="font-medium text-ink">{usd(order.total)} is secured — go ahead with production</p><p className="text-sm text-ink-medium">When the goods leave your facility, mark the order as shipped with tracking details.</p></div></div>
            <Button onClick={() => setModal('ship')}><Truck className="h-4 w-4" /> Mark as shipped</Button>
          </Card>
        )}
        {isBuyer && order.paymentStatus === 'held' && (
          <Card className="card-pad flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-forest" /><div><p className="font-medium text-ink">Your {usd(order.total)} is held safely</p><p className="text-sm text-ink-medium">{order.fulfillment === 'shipped' ? 'Once the goods arrive and look right, confirm delivery to release payment to the seller.' : 'The seller is producing your order. You’ll be notified when it ships.'}</p></div></div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setModal('dispute')}><AlertTriangle className="h-4 w-4" /> Report a problem</Button>
              <Button onClick={() => setModal('deliver')}><PackageCheck className="h-4 w-4" /> Confirm delivery</Button>
            </div>
          </Card>
        )}
        {!isBuyer && order.paymentStatus === 'held' && order.fulfillment === 'shipped' && <Alert type="info">Shipped {date(order.shippedAt)}. Funds are released when the buyer confirms delivery. <button onClick={() => setModal('dispute')} className="link">Report a problem</button></Alert>}
        {order.paymentStatus === 'released' && <Alert type="success">{isBuyer ? 'Order complete — thank you for sourcing with Ranavista.' : `Funds released ${date(order.releasedAt)} — ${usd(order.sellerPayout)} sent to your payout account.`}</Alert>}
        {order.paymentStatus === 'refunded' && <Alert type="info">This order was refunded on {date(order.refundedAt)}.</Alert>}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-4"><h3 className="text-lg text-forest">Items</h3></div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
                <tbody>{order.lines.map((l, i) => <tr key={i}><td className="font-medium">{l.name}</td><td className="text-right">{num(l.quantity)} {l.unit}</td><td className="text-right">{usd(l.unitPrice)}</td><td className="text-right">{usd(l.unitPrice * l.quantity)}</td></tr>)}</tbody>
                <tfoot>
                  <tr><td colSpan={3} className="text-right text-ink-medium">Subtotal</td><td className="text-right">{usd(order.subtotal)}</td></tr>
                  <tr><td colSpan={3} className="text-right text-ink-medium">Shipping</td><td className="text-right">{usd(order.shippingCost)}</td></tr>
                  <tr><td colSpan={3} className="text-right font-medium text-forest">Order total</td><td className="text-right font-serif text-lg text-forest">{usd(order.total)}</td></tr>
                  {!isBuyer && <>
                    <tr><td colSpan={3} className="text-right text-ink-medium">Ranavista fee</td><td className="text-right text-ink-medium">−{usd(order.platformFee)}</td></tr>
                    <tr><td colSpan={3} className="text-right font-medium text-success">Your payout</td><td className="text-right font-medium text-success">{usd(order.sellerPayout)}</td></tr>
                  </>}
                </tfoot>
              </table>
            </div>
          </Card>

          {dispute && (
            <Card className="overflow-hidden border-danger/30">
              <div className="flex items-center justify-between border-b border-mist bg-danger/5 px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg text-danger"><AlertTriangle className="h-5 w-5" /> Dispute</h3>
                <StatusBadge status={dispute.status.startsWith('resolved') ? 'closed' : 'disputed'} labels={{ closed: dispute.status.replace('resolved_', 'Resolved: '), disputed: dispute.status === 'open' ? 'Open' : 'Under review' }} />
              </div>
              <div className="space-y-3 px-6 py-4">
                <p className="text-sm"><b>Reason:</b> {REASONS.find((r) => r.value === dispute.reason)?.label}</p>
                {dispute.thread.map((t, i) => (
                  <div key={i} className={cx('rounded-lg px-3.5 py-2.5 text-sm', t.role === 'admin' ? 'bg-forest/5 ring-1 ring-forest/10' : 'bg-cream/70')}>
                    <p className="text-xs font-medium text-ink-medium">{t.role === 'admin' ? 'Ranavista team' : t.by?.name} · {dateTime(t.at)}</p>
                    <p className="mt-0.5 whitespace-pre-line">{t.text}</p>
                  </div>
                ))}
                {dispute.resolution?.note && <Alert type="info">Resolution: {dispute.resolution.note}</Alert>}
                {['open', 'under_review'].includes(dispute.status) && (
                  <form onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/orders/${id}/dispute/message`, { text: note }).then(() => setNote('')), true); }} className="flex gap-2 pt-2">
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add details, photos links or tracking info…" />
                    <Button disabled={!note.trim()} loading={busy}>Send</Button>
                  </form>
                )}
              </div>
            </Card>
          )}

          {(canReview || myReview || theirReview) && (
            <Card className="card-pad space-y-4">
              <h3 className="text-lg text-forest">Reviews</h3>
              {theirReview && <div className="rounded-lg bg-cream/60 p-3.5"><Stars value={theirReview.rating} /><p className="mt-1 text-sm">{theirReview.comment}</p><p className="mt-1 text-xs text-ink-medium">— {theirReview.from?.company || theirReview.from?.name}</p></div>}
              {myReview && <div className="rounded-lg border border-beige p-3.5"><p className="mb-1 text-xs text-ink-medium">Your review</p><Stars value={myReview.rating} /><p className="mt-1 text-sm">{myReview.comment}</p></div>}
              {canReview && <Button variant="outline" onClick={() => { setForm({ rating: 5, comment: '' }); setModal('review'); }}><Star className="h-4 w-4" /> Rate the {isBuyer ? 'seller' : 'buyer'}</Button>}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="card-pad text-sm">
            <p className="eyebrow">{isBuyer ? 'Seller' : 'Buyer'}</p>
            <p className="mt-2 font-serif text-xl text-forest">{other?.company || other?.name}</p>
            {isBuyer && other?.seller?.ratingCount > 0 && <p className="mt-1 flex items-center gap-1.5"><Stars value={other.seller.rating} /> <span className="text-xs text-ink-medium">({other.seller.ratingCount})</span></p>}
            {!isBuyer && other?.address && <p className="mt-2 text-ink-medium">{[other.address.line1, other.address.city, other.address.state, other.address.zip].filter(Boolean).join(', ')}</p>}
            {!isBuyer && other?.email && <p className="text-ink-medium">{other.email}{other.phone ? ` · ${other.phone}` : ''}</p>}
            <Link to={`/${role}/${isBuyer ? 'rfqs' : 'leads'}/${order.rfq?._id}`} className="link mt-3 inline-block">Open RFQ & messages →</Link>
          </Card>
          {order.tracking?.carrier && (
            <Card className="card-pad text-sm">
              <p className="eyebrow">Shipment</p>
              <p className="mt-2"><b>{order.tracking.carrier}</b> {order.tracking.number && <span className="font-mono text-xs">#{order.tracking.number}</span>}</p>
              {order.tracking.note && <p className="mt-1 text-ink-medium">{order.tracking.note}</p>}
            </Card>
          )}
          {order.rfq?.containerType && order.rfq.containerType !== 'none' && <ContainerFill items={order.lines} type={order.rfq.containerType} readOnly />}
        </div>
      </div>

      {/* MODALS */}
      <Modal open={modal === 'ship'} onClose={() => setModal(null)} title="Mark as shipped"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => run(() => api.post(`/orders/${id}/ship`, form))}>Confirm shipment</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carrier / line"><Input value={form.carrier || ''} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Maersk, MSC, DHL…" /></Field>
          <Field label="Tracking / B/L number"><Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Note to buyer" className="sm:col-span-2"><Textarea rows={3} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ETA at port, container number, documents sent…" /></Field>
        </div>
      </Modal>

      <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Confirm delivery"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Not yet</Button><Button loading={busy} onClick={() => run(() => api.post(`/orders/${id}/confirm-delivery`))}>Yes, release payment</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="text-sm text-ink-medium">By confirming, you agree the goods arrived as ordered. <b className="text-ink">{usd(order.total)}</b> will be released to the seller and this can’t be reversed. If anything is wrong, report a problem instead.</p>
      </Modal>

      <Modal open={modal === 'dispute'} onClose={() => setModal(null)} title="Report a problem"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={busy} disabled={!form.reason || !form.description} onClick={() => run(() => api.post(`/orders/${id}/dispute`, form))}>Open dispute</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="mb-4 text-sm text-ink-medium">Funds stay frozen while our team reviews the case with both sides. Most disputes are resolved within 5 business days.</p>
        <Field label="What happened?"><Select value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} options={REASONS} placeholder="Choose a reason" /></Field>
        <Field label="Details" className="mt-4"><Textarea rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue. Include photo links, carton counts, inspection reports…" /></Field>
      </Modal>

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title={`Rate the ${isBuyer ? 'seller' : 'buyer'}`}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => run(() => api.post(`/orders/${id}/review`, form))}>Submit review</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <div className="flex justify-center py-2"><Stars value={form.rating || 0} size="h-8 w-8" onChange={(v) => setForm({ ...form, rating: v })} /></div>
        <Field label="Comments" className="mt-4"><Textarea rows={4} value={form.comment || ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={isBuyer ? 'Quality, communication, packaging, on-time delivery…' : 'Clarity of requirements, payment, communication…'} /></Field>
      </Modal>
    </>
  );
}

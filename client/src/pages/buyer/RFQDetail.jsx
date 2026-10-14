import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Hourglass, Package, UserCheck } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { usd } from '../../lib/format';
import { Alert, Button, Card, Field, Modal, PageHeader, PageLoader, StatusBadge, Textarea, cx } from '../../components/ui';
import { ItemsTable, PriceEditor, QuoteView, RfqSummary } from '../../components/RfqParts';
import ContainerFill from '../../components/ContainerFill';
import Chat from '../../components/Chat';

const STAGES = [
  { key: 'pending', label: 'Under review', icon: Hourglass, text: 'Our sourcing team is reviewing your request and picking the best-fit seller.' },
  { key: 'assigned', label: 'With seller', icon: UserCheck, text: 'A verified seller has your RFQ and is preparing a quotation.' },
  { key: 'quoted', label: 'Quote ready', icon: Clock, text: 'Review the quotation below — accept it or send a counter-offer.' },
  { key: 'accepted', label: 'Order created', icon: CheckCircle2, text: 'You accepted the quote. Complete payment to start production.' },
];
const stageIdx = (s) => ({ pending: 0, assigned: 1, quoted: 2, negotiating: 2, accepted: 3 }[s] ?? -1);

export default function BuyerRFQDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(`/rfqs/${id}`);
  const [modal, setModal] = useState(null);
  const [prices, setPrices] = useState({});
  const [message, setMessage] = useState('');
  const [another, setAnother] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { rfq, quotes, order } = data;
  const quote = quotes.find((q) => !['rejected', 'withdrawn'].includes(q.status));
  const idx = stageIdx(rfq.status);

  const act = async (fn) => {
    setBusy(true);
    setErr('');
    try { await fn(); setModal(null); setMessage(''); await reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const accept = () => act(async () => { const { data: d } = await api.post(`/rfqs/quotes/${quote._id}/accept`); nav(`/buyer/orders/${d.order._id}`); });
  const counter = () => act(() => api.post(`/rfqs/quotes/${quote._id}/counter`, { message, lines: Object.entries(prices).filter(([, v]) => v !== '').map(([itemId, unitPrice]) => ({ itemId, unitPrice })) }));
  const reject = () => act(() => api.post(`/rfqs/quotes/${quote._id}/reject`, { reason: message, requestAnotherSeller: another }));
  const cancel = () => act(() => api.post(`/rfqs/${rfq._id}/cancel`));
  const counterTotal = quote ? quote.lines.reduce((s, l) => s + Number(prices[l.itemId] ?? l.unitPrice) * l.quantity, 0) + (quote.shippingCost || 0) : 0;

  return (
    <>
      <PageHeader
        back={<Link to="/buyer/rfqs" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> My RFQs</Link>}
        title={rfq.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{rfq.number} <StatusBadge status={rfq.status} /></span>}
        actions={['pending', 'assigned', 'quoted', 'negotiating'].includes(rfq.status) && <Button variant="ghost" onClick={() => setModal('cancel')}>Cancel RFQ</Button>}
      />
      {sp.get('posted') && rfq.status === 'pending' && <Alert type="success" className="mb-5">RFQ submitted! Our team will route it to a verified seller — usually within 24–48 hours. We’ll email you at each step.</Alert>}
      {err && !modal && <Alert type="error" className="mb-5">{err}</Alert>}

      {idx >= 0 && (
        <Card className="card-pad mb-6">
          <ol className="grid gap-4 sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3 sm:flex-col">
                <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', i < idx ? 'bg-success text-white' : i === idx ? 'bg-gold text-white ring-4 ring-gold/20' : 'bg-mist text-ink-medium')}><s.icon className="h-4 w-4" /></div>
                <div><p className={cx('text-sm font-medium', i <= idx ? 'text-ink' : 'text-ink-medium')}>{s.label}</p>{i === idx && <p className="mt-0.5 text-xs text-ink-medium">{s.text}</p>}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {order && (
            <Alert type="success">Order <b>{order.number}</b> created · <StatusBadge status={order.paymentStatus} /> <Link to={`/buyer/orders/${order._id}`} className="link ml-1">Open order →</Link></Alert>
          )}
          {quote && (
            <QuoteView quote={quote} items={rfq.items} viewer="buyer">
              {['submitted', 'revised'].includes(quote.status) && (
                <>
                  <Button onClick={accept} loading={busy}><CheckCircle2 className="h-4 w-4" /> Accept {usd(quote.total)}</Button>
                  <Button variant="outline" onClick={() => { setPrices({}); setModal('counter'); }}>Counter-offer</Button>
                  <Button variant="ghost" onClick={() => setModal('reject')}>Decline</Button>
                </>
              )}
              {quote.status === 'countered' && <p className="text-sm text-ink-medium">Counter-offer sent — waiting for the seller to respond.</p>}
              {quote.status === 'accepted' && order && <Link to={`/buyer/orders/${order._id}`} className="btn-primary"><Package className="h-4 w-4" /> Go to order</Link>}
            </QuoteView>
          )}
          <RfqSummary rfq={rfq} />
          <ItemsTable items={rfq.items} />
        </div>
        <div className="space-y-6">
          {rfq.containerType !== 'none' && <ContainerFill items={quote?.lines || rfq.items} type={rfq.containerType} readOnly />}
          {quote && <Chat rfqId={rfq._id} counterpart={quote.seller?.company || 'your seller'} />}
        </div>
      </div>

      <Modal open={modal === 'counter'} onClose={() => setModal(null)} title="Send a counter-offer"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={counter}>Send counter · {usd(counterTotal)}</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="mb-4 text-sm text-ink-medium">Enter the unit prices you’d like. Leave a field empty to keep the seller’s price.</p>
        {quote && <PriceEditor lines={quote.lines} value={prices} onChange={setPrices} />}
        <Field label="Message to seller" className="mt-4"><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We can commit to a second container in Q2 if we can meet this price." /></Field>
      </Modal>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Decline this quotation"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Back</Button><Button variant="danger" loading={busy} onClick={reject}>Decline quote</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <Field label="Reason (shared with our team)"><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Price too high, lead time too long…" /></Field>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="mt-0.5 accent-forest" /> Send my RFQ to a different seller (free)</label>
      </Modal>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this RFQ?"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Keep it</Button><Button variant="danger" loading={busy} onClick={cancel}>Cancel RFQ</Button></>}>
        <p className="text-sm text-ink-medium">The seller will be notified and the RFQ will be closed. This can’t be undone.</p>
      </Modal>
    </>
  );
}

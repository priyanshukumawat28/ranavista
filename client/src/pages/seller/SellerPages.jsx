import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CheckCircle2, Clock, ExternalLink, Inbox, MessageSquareQuote, Package, Send, Star, Timer, Wallet } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../lib/auth';
import { date, num, timeLeft, usd, usd0 } from '../../lib/format';
import { Alert, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Stars, Stat, StatusBadge, Tabs, Textarea, cx } from '../../components/ui';
import { ItemsTable, PriceEditor, QuoteView, RfqSummary } from '../../components/RfqParts';
import ContainerFill from '../../components/ContainerFill';
import Chat from '../../components/Chat';

const SELLER_LABELS = { assigned: 'New lead', quoted: 'Quote sent', negotiating: 'Negotiating', accepted: 'Won' };

/* ----------------------------- DASHBOARD ----------------------------- */
export function SellerDashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch('/dashboard');
  const { data: leads } = useFetch('/rfqs?status=assigned,quoted,negotiating');
  if (loading || !data) return <PageLoader />;
  const s = data.stats;
  return (
    <>
      <PageHeader title={`Welcome, ${user.company || user.name}`} subtitle="Exclusive leads hand-picked for your factory." />
      {!user.seller?.payoutsEnabled && user.seller?.approval === 'approved' && (
        <Alert type="warning" className="mb-5">Connect your payout account so we can release funds to you. <Link to="/seller/payouts" className="link">Set up payouts →</Link></Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New leads" value={s.newLeads} icon={Inbox} tone="gold" hint={s.newLeads ? 'Waiting for your quote' : undefined} />
        <Stat label="Quotes in play" value={s.quoted} icon={MessageSquareQuote} />
        <Stat label="Funds on hold" value={usd0(s.held)} icon={Clock} tone="blue" hint="Released on delivery" />
        <Stat label="Total earned" value={usd0(s.earned)} icon={Banknote} tone="sage" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-mist px-6 py-4"><h2 className="text-lg text-forest">Active leads</h2><Link to="/seller/leads" className="link text-sm">All leads</Link></div>
          {!leads?.length ? <Empty icon={Inbox} title="No active leads" text="When our team matches a buyer RFQ to your factory, it appears here — and only you can quote on it." /> : (
            <ul className="divide-y divide-mist">
              {leads.slice(0, 6).map((r) => (
                <li key={r._id}><Link to={`/seller/leads/${r._id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-cream/40">
                  <div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="text-xs text-ink-medium">{r.number} · {r.category}</p></div>
                  <div className="flex shrink-0 items-center gap-3">
                    {r.status === 'assigned' && r.responseDueAt && <span className={cx('flex items-center gap-1 text-xs', new Date(r.responseDueAt) < Date.now() + 12 * 36e5 ? 'text-danger' : 'text-ink-medium')}><Timer className="h-3.5 w-3.5" />{timeLeft(r.responseDueAt)}</span>}
                    <StatusBadge status={r.status} labels={SELLER_LABELS} />
                  </div>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="card-pad">
          <p className="eyebrow">Performance</p>
          <div className="mt-3 flex items-center gap-2"><span className="font-serif text-4xl">{s.rating ? s.rating.toFixed(1) : '—'}</span><Stars value={s.rating} /></div>
          <p className="text-sm text-ink-medium">{s.ratingCount} buyer reviews</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-cream p-3"><p className="text-xs text-ink-medium">Leads received</p><p className="font-serif text-xl">{user.seller?.leadsReceived || 0}</p></div>
            <div className="rounded-lg bg-cream p-3"><p className="text-xs text-ink-medium">Response rate</p><p className="font-serif text-xl">{user.seller?.leadsReceived ? Math.round(((user.seller.leadsQuoted || 0) / user.seller.leadsReceived) * 100) : 0}%</p></div>
          </div>
          <p className="mt-5 text-xs text-ink-medium">Plan: <b>{data.plan?.name}</b>. Fast, competitive quotes and good reviews move you up our team’s selection list. <Link to="/seller/subscription" className="link">Upgrade</Link></p>
        </Card>
      </div>
    </>
  );
}

/* ----------------------------- LEADS LIST ----------------------------- */
export function Leads() {
  const { data, loading } = useFetch('/rfqs');
  const [tab, setTab] = useState('new');
  const groups = { new: ['assigned'], active: ['quoted', 'negotiating'], won: ['accepted'], all: null };
  const list = (data || []).filter((r) => !groups[tab] || groups[tab].includes(r.status));
  return (
    <>
      <PageHeader title="My leads" subtitle="Each lead is exclusive to you. Quote before the response window closes or it will be reassigned." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'new', label: 'New', count: (data || []).filter((r) => r.status === 'assigned').length }, { value: 'active', label: 'Quoted' }, { value: 'won', label: 'Won' }, { value: 'all', label: 'All' }]} />
      {loading ? <PageLoader /> : !list.length ? <Card><Empty icon={Inbox} title="Nothing here" text="New exclusive leads will show up here." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <Link key={r._id} to={`/seller/leads/${r._id}`} className="card card-pad block transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs text-ink-medium">{r.number} · {r.category}</p><h3 className="mt-1 truncate text-lg text-forest">{r.title}</h3></div>
                <StatusBadge status={r.status} labels={SELLER_LABELS} />
              </div>
              <p className="mt-3 text-sm text-ink-medium">{r.items.length} item{r.items.length > 1 ? 's' : ''} · {num(r.items.reduce((s, i) => s + i.quantity, 0))} units · {r.incoterm} · {r.destination?.state ? `${r.destination.state}, USA` : 'USA'}</p>
              <div className="mt-4 flex items-center justify-between border-t border-mist pt-3 text-xs">
                <span className="text-ink-medium">Buyer deadline {date(r.deadline)}</span>
                {r.status === 'assigned' && r.responseDueAt && <span className="flex items-center gap-1 font-medium text-danger"><Timer className="h-3.5 w-3.5" />{timeLeft(r.responseDueAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ----------------------------- LEAD DETAIL + QUOTE FORM ----------------------------- */
export function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/rfqs/${id}`);
  const [q, setQ] = useState(null);
  const [prices, setPrices] = useState({});
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data?.rfq && !q) {
      const valid = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      setQ({ lines: Object.fromEntries(data.rfq.items.map((i) => [i._id, { unitPrice: '', quantity: i.quantity }])), shippingCost: '', leadTimeDays: 45, validUntil: valid, incoterm: data.rfq.incoterm, paymentTerms: '100% via Ranavista escrow', notes: '' });
    }
  }, [data, q]);

  const quoteTotal = useMemo(() => {
    if (!q || !data) return 0;
    return data.rfq.items.reduce((s, i) => s + Number(q.lines[i._id]?.unitPrice || 0) * Number(q.lines[i._id]?.quantity || i.quantity), 0) + Number(q.shippingCost || 0);
  }, [q, data]);

  if ((loading && !data) || !q) return error ? <Alert type="error">{error}</Alert> : <PageLoader />;
  const { rfq, quotes, order } = data;
  const quote = quotes.find((x) => !['rejected', 'withdrawn'].includes(x.status));
  const pending = user.seller?.approval !== 'approved';

  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); setModal(null); setMsg(''); await reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const submitQuote = (e) => {
    e.preventDefault();
    run(() => api.post(`/rfqs/${rfq._id}/quote`, {
      ...q, shippingCost: Number(q.shippingCost || 0),
      lines: Object.entries(q.lines).map(([itemId, v]) => ({ itemId, unitPrice: Number(v.unitPrice), quantity: Number(v.quantity) })),
    }));
  };
  const revise = () => run(() => api.post(`/rfqs/quotes/${quote._id}/revise`, { message: msg, lines: Object.entries(prices).filter(([, v]) => v !== '').map(([itemId, unitPrice]) => ({ itemId, unitPrice })) }));
  const decline = () => run(async () => { await api.post(`/rfqs/${rfq._id}/decline`, { reason: msg }); nav('/seller/leads'); });
  const lastBuyerRound = quote?.rounds?.filter((r) => r.by === 'buyer').slice(-1)[0];

  return (
    <>
      <PageHeader back={<Link to="/seller/leads" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> My leads</Link>}
        title={rfq.title} subtitle={<span className="flex flex-wrap items-center gap-2">{rfq.number} <StatusBadge status={rfq.status} labels={SELLER_LABELS} />{rfq.status === 'assigned' && rfq.responseDueAt && <span className="inline-flex items-center gap-1 text-danger"><Timer className="h-3.5 w-3.5" /> {timeLeft(rfq.responseDueAt)} to quote</span>}</span>}
        actions={rfq.status === 'assigned' && <Button variant="ghost" onClick={() => setModal('decline')}>Can’t quote this</Button>} />
      {err && !modal && <Alert type="error" className="mb-5">{err}</Alert>}
      {order && <Alert type="success" className="mb-5">You won this order! <Link to={`/seller/orders/${order._id}`} className="link">Open order {order.number} →</Link></Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {quote && (
            <QuoteView quote={quote} items={rfq.items} viewer="seller">
              {quote.status === 'countered' && (
                <div className="w-full">
                  <Alert type="warning" className="mb-3">Buyer countered at <b>{usd(lastBuyerRound?.total)}</b>{lastBuyerRound?.message ? ` — “${lastBuyerRound.message}”` : ''}</Alert>
                  <Button onClick={() => { setPrices(Object.fromEntries((lastBuyerRound?.lines || []).map((l) => [l.itemId, l.unitPrice]))); setModal('revise'); }}>Respond with revised prices</Button>
                </div>
              )}
              {['submitted', 'revised'].includes(quote.status) && <p className="text-sm text-ink-medium">Waiting for the buyer’s decision.</p>}
            </QuoteView>
          )}
          <RfqSummary rfq={rfq} showBuyer />
          {!quote && rfq.status === 'assigned' && (
            <form onSubmit={submitQuote}>
              <Card className="overflow-hidden">
                <div className="border-b border-mist bg-cream/50 px-6 py-4"><h3 className="text-lg text-forest">Your quotation (USD)</h3><p className="text-xs text-ink-medium">Only you received this lead. Price competitively — the buyer can counter or ask us for another seller.</p></div>
                {pending && <Alert type="warning" className="m-6 mb-0">Your account must be approved before you can send quotes.</Alert>}
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Target</th><th className="w-40 text-right">Your unit price</th><th className="text-right">Amount</th></tr></thead>
                    <tbody>
                      {rfq.items.map((i) => {
                        const v = q.lines[i._id];
                        return (
                          <tr key={i._id}>
                            <td><p className="font-medium">{i.name}</p>{i.specs && <p className="text-xs text-ink-medium">{i.specs}</p>}</td>
                            <td className="text-right"><input type="number" min="1" className="input w-24 py-1.5 text-right" value={v.quantity} onChange={(e) => setQ({ ...q, lines: { ...q.lines, [i._id]: { ...v, quantity: e.target.value } } })} /> <span className="text-xs text-ink-medium">{i.unit}</span></td>
                            <td className="text-right text-ink-medium">{i.targetUnitPrice ? usd(i.targetUnitPrice) : '—'}</td>
                            <td className="text-right"><div className="relative"><span className="absolute left-2.5 top-2 text-sm text-ink-medium">$</span><input required type="number" min="0.01" step="0.01" className="input py-1.5 pl-6 text-right" value={v.unitPrice} onChange={(e) => setQ({ ...q, lines: { ...q.lines, [i._id]: { ...v, unitPrice: e.target.value } } })} /></div></td>
                            <td className="text-right font-medium">{usd(Number(v.unitPrice || 0) * Number(v.quantity || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 border-t border-mist p-6 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Shipping / freight ($)"><Input type="number" min="0" step="0.01" value={q.shippingCost} onChange={(e) => setQ({ ...q, shippingCost: e.target.value })} placeholder="0 for FOB" /></Field>
                  <Field label="Lead time (days)"><Input type="number" min="1" required value={q.leadTimeDays} onChange={(e) => setQ({ ...q, leadTimeDays: e.target.value })} /></Field>
                  <Field label="Valid until"><Input type="date" required value={q.validUntil} onChange={(e) => setQ({ ...q, validUntil: e.target.value })} /></Field>
                  <Field label="Incoterm"><Input value={q.incoterm} onChange={(e) => setQ({ ...q, incoterm: e.target.value })} /></Field>
                  <Field label="Notes for buyer" className="sm:col-span-2 lg:col-span-4"><Textarea rows={3} value={q.notes} onChange={(e) => setQ({ ...q, notes: e.target.value })} placeholder="MOQ, packaging, samples, certifications, port of loading…" /></Field>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist bg-cream/40 px-6 py-4">
                  <p className="text-sm text-ink-medium">Quotation total <span className="ml-2 font-serif text-2xl text-ink">{usd(quoteTotal)}</span></p>
                  <Button loading={busy} disabled={pending}><Send className="h-4 w-4" /> Send quotation</Button>
                </div>
              </Card>
            </form>
          )}
          <ItemsTable items={rfq.items} />
        </div>
        <div className="space-y-6">
          {rfq.containerType !== 'none' && <ContainerFill items={rfq.items} type={rfq.containerType} readOnly />}
          <Chat rfqId={rfq._id} counterpart={rfq.buyer?.company || 'the buyer'} />
        </div>
      </div>

      <Modal open={modal === 'revise'} onClose={() => setModal(null)} title="Revise your quotation"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={revise}>Send revision</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="mb-4 text-sm text-ink-medium">Prefilled with the buyer’s counter. Adjust to the prices you can accept.</p>
        {quote && <PriceEditor lines={quote.lines} value={prices} onChange={setPrices} />}
        <Field label="Message" className="mt-4"><Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
      </Modal>
      <Modal open={modal === 'decline'} onClose={() => setModal(null)} title="Decline this lead?"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Back</Button><Button variant="danger" loading={busy} onClick={decline}>Decline lead</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="mb-3 text-sm text-ink-medium">The lead goes back to the Ranavista team to assign to another seller. Declining is better than letting it expire.</p>
        <Field label="Reason"><Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Outside our capacity, category, MOQ…" /></Field>
      </Modal>
    </>
  );
}

/* ----------------------------- PAYOUTS ----------------------------- */
export function Payouts() {
  const { data, loading, reload } = useFetch('/payouts');
  const [sp] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (sp.get('done') || sp.get('demo_onboarded')) reload(); }, [sp, reload]);
  const onboard = async () => {
    setBusy(true);
    try { const { data: d } = await api.post('/payouts/onboard'); window.location.href = d.url; } catch (x) { setErr(errMsg(x)); setBusy(false); }
  };
  const dash = async () => { try { const { data: d } = await api.post('/payouts/dashboard'); window.open(d.url, '_blank'); } catch (x) { setErr(errMsg(x)); } };
  if (loading || !data) return <PageLoader />;
  const held = data.orders.filter((o) => ['held', 'disputed'].includes(o.paymentStatus)).reduce((s, o) => s + o.sellerPayout, 0);
  const paid = data.orders.filter((o) => o.paymentStatus === 'released').reduce((s, o) => s + o.sellerPayout, 0);
  return (
    <>
      <PageHeader title="Payouts" subtitle="Powered by Stripe Connect. Funds are released after the buyer confirms delivery." />
      {err && <Alert type="error" className="mb-5">{err}</Alert>}
      <Card className="card-pad mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className={cx('rounded-xl p-3', data.payoutsEnabled ? 'bg-success/10 text-success' : 'bg-warning/20 text-[#94640f]')}>{data.payoutsEnabled ? <CheckCircle2 className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}</div>
          <div>
            <p className="font-medium">{data.payoutsEnabled ? 'Payout account connected' : data.connected ? 'Finish setting up your payout account' : 'Connect a payout account'}</p>
            <p className="text-sm text-ink-medium">{data.payoutsEnabled ? 'You’re ready to receive funds.' : 'Stripe will verify your business and bank details. Takes about 5 minutes.'}</p>
          </div>
        </div>
        {data.payoutsEnabled ? (!data.demo && <Button variant="outline" onClick={dash}>Open Stripe dashboard <ExternalLink className="h-4 w-4" /></Button>) : <Button loading={busy} onClick={onboard}>{data.connected ? 'Continue setup' : 'Connect with Stripe'}</Button>}
      </Card>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="On hold (pending delivery)" value={usd(held)} icon={Clock} tone="blue" />
        <Stat label="Paid out" value={usd(paid)} icon={Banknote} tone="sage" />
      </div>
      <Card className="overflow-hidden">
        {!data.orders.length ? <Empty icon={Package} title="No payouts yet" /> : (
          <table className="table">
            <thead><tr><th>Order</th><th className="text-right">Order total</th><th className="text-right">Fee</th><th className="text-right">Your payout</th><th>Status</th><th>Released</th></tr></thead>
            <tbody>{data.orders.map((o) => (
              <tr key={o._id}><td><Link to={`/seller/orders/${o._id}`} className="font-medium text-forest hover:underline">{o.number}</Link></td><td className="text-right">{usd(o.total)}</td><td className="text-right text-ink-medium">{usd(o.platformFee)}</td><td className="text-right font-medium">{usd(o.sellerPayout)}</td><td><StatusBadge status={o.paymentStatus} /></td><td className="text-ink-medium">{date(o.releasedAt)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/* ----------------------------- REVIEWS ----------------------------- */
export function Reviews() {
  const { data, loading } = useFetch('/reviews/me');
  const avg = data?.length ? data.reduce((s, r) => s + r.rating, 0) / data.length : 0;
  return (
    <>
      <PageHeader title="Reviews" subtitle="What buyers say about working with you." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="card-pad h-fit text-center">
          <p className="font-serif text-5xl">{avg ? avg.toFixed(1) : '—'}</p>
          <div className="mt-2 flex justify-center"><Stars value={avg} size="h-5 w-5" /></div>
          <p className="mt-1 text-sm text-ink-medium">{data?.length || 0} reviews</p>
        </Card>
        <Card className="overflow-hidden">
          {loading ? <PageLoader /> : !data?.length ? <Empty icon={Star} title="No reviews yet" text="Buyers can rate you after each completed order." /> : (
            <ul className="divide-y divide-mist">
              {data.map((r) => (
                <li key={r._id} className="px-6 py-5">
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-ink-medium">{date(r.createdAt)}</span></div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  <p className="mt-2 text-xs text-ink-medium">{r.from?.company || r.from?.name} · {r.order?.number}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

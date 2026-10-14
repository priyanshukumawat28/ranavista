import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, History, Lock, MessageSquare, Paperclip, Search, Send, ShieldCheck, Star, Unlock, UserMinus } from 'lucide-react';
import api, { errMsg, fileUrl } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { date, dateTime, num, timeLeft, usd } from '../lib/format';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, PageLoader, Select, StatusBadge, Textarea, cx } from '../components/ui';
import ContainerFill from '../components/ContainerFill';

const ACTION_LABEL = { created: 'Posted by buyer', assigned: 'Assigned', reassigned: 'Reassigned', unassigned: 'Unassigned', quoted: 'Quote sent', accepted: 'Quote accepted', cancelled: 'Cancelled', closed: 'Closed', expired: 'Expired' };
const TIER_COLOR = { seller_enterprise: 'gold', seller_pro: 'green', seller_starter: 'gray' };

/* ---------------- Seller Selection Panel ---------------- */
function SellerPanel({ rfq, onDone }) {
  const { user } = useAuth();
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [lock, setLock] = useState({ state: 'checking' });
  const [pick, setPick] = useState(null);
  const [hours, setHours] = useState('48');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mode = rfq.status === 'pending' ? 'assign' : 'reassign';

  const load = useCallback(() => {
    api.get(`/admin/rfqs/${rfq._id}/candidates?${new URLSearchParams({ ...(all && { all: '1' }), ...(q && { q }) })}`).then((r) => setList(r.data)).catch((e) => setErr(errMsg(e)));
  }, [rfq._id, all, q]);
  useEffect(() => { load(); }, [load]);

  // Acquire the assignment lock while this admin has the panel open
  useEffect(() => {
    let alive = true;
    const take = () => api.post(`/admin/rfqs/${rfq._id}/lock`).then((r) => alive && setLock({ state: 'mine', until: r.data.lockedUntil })).catch((e) => alive && setLock({ state: 'taken', msg: errMsg(e) }));
    take();
    const t = setInterval(take, 4 * 60 * 1000);
    return () => { alive = false; clearInterval(t); api.post(`/admin/rfqs/${rfq._id}/unlock`).catch(() => {}); };
  }, [rfq._id]);

  const push = async () => {
    setBusy(true); setErr('');
    try { await api.post(`/admin/rfqs/${rfq._id}/${mode}`, { sellerId: pick._id, hours: Number(hours), note }); setPick(null); onDone(); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <Card className="overflow-hidden ring-2 ring-gold/40">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-forest px-6 py-4 text-white">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-light">Seller selection panel</p>
          <h2 className="font-serif text-xl">{mode === 'assign' ? 'Push this lead to one seller' : 'Reassign to a different seller'}</h2>
        </div>
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs', lock.state === 'mine' ? 'bg-success/20 text-white' : lock.state === 'taken' ? 'bg-danger/30' : 'bg-white/10')}>
          {lock.state === 'mine' ? <><Lock className="h-3 w-3" /> Locked by you</> : lock.state === 'taken' ? <><Lock className="h-3 w-3" /> {lock.msg}</> : 'Checking lock…'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-mist px-6 py-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-forest" /> Show sellers outside <b>{rfq.category}</b></label>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative ml-auto w-full sm:w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-medium" /><Input className="py-2 pl-9" placeholder="Search sellers" value={q} onChange={(e) => setQ(e.target.value)} /></form>
      </div>
      {err && <Alert type="error" className="m-4">{err}</Alert>}
      <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
        {!list && <PageLoader />}
        {list?.length === 0 && <p className="col-span-full py-10 text-center text-sm text-ink-medium">No approved sellers in this category. Tick “Show sellers outside” or approve pending sellers.</p>}
        {list?.map((s) => {
          const current = String(rfq.assignedSeller?._id) === String(s._id);
          return (
            <div key={s._id} className={cx('flex flex-col rounded-xl border p-4 transition', current ? 'border-forest bg-forest/5' : 'border-beige bg-white hover:border-gold hover:shadow-soft')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><Link to={`/sellers/${s._id}`} className="block truncate font-medium text-forest hover:underline">{s.company || s.name}</Link><p className="text-xs text-ink-medium">{s.country}</p></div>
                <Badge color={TIER_COLOR[s.planKey] || 'gray'}>{s.plan}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-cream py-2"><p className="flex items-center justify-center gap-0.5 font-semibold text-ink"><Star className="h-3 w-3 fill-gold text-gold" />{s.rating ? s.rating.toFixed(1) : '—'}</p><p className="text-ink-medium">{s.ratingCount} reviews</p></div>
                <div className="rounded-lg bg-cream py-2"><p className="font-semibold text-ink">{s.responseRate === null ? '—' : `${s.responseRate}%`}</p><p className="text-ink-medium">response</p></div>
                <div className="rounded-lg bg-cream py-2"><p className="font-semibold text-ink">{s.openLeads}</p><p className="text-ink-medium">open leads</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">{s.categories?.slice(0, 4).map((c) => <span key={c} className={cx('rounded px-1.5 py-0.5 text-[10px]', c === rfq.category ? 'bg-forest text-white' : 'bg-mist text-ink-medium')}>{c}</span>)}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {s.payoutsEnabled ? <span className="text-success">✓ Payouts connected</span> : <span className="text-[#94640f]">Payouts not set up</span>}
                {s.previouslyAssigned && <span className="text-danger">Previously had this lead</span>}
              </div>
              <Button size="sm" variant={current ? 'ghost' : 'primary'} className="mt-4" disabled={current || lock.state !== 'mine'} onClick={() => { setPick(s); setErr(''); }}>
                {current ? 'Currently assigned' : mode === 'assign' ? <><Send className="h-3.5 w-3.5" /> Push lead</> : 'Reassign here'}
              </Button>
            </div>
          );
        })}
      </div>

      <Modal open={!!pick} onClose={() => setPick(null)} title={mode === 'assign' ? 'Confirm lead assignment' : 'Confirm reassignment'}
        footer={<><Button variant="ghost" onClick={() => setPick(null)}>Cancel</Button><Button loading={busy} onClick={push}><Check className="h-4 w-4" /> {mode === 'assign' ? 'Push to seller' : 'Reassign'}</Button></>}>
        {err && <Alert type="error" className="mb-4">{err}</Alert>}
        <p className="text-sm">Send <b>{rfq.number}</b> exclusively to <b>{pick?.company}</b>. Only this seller will be notified and able to quote.</p>
        {mode === 'reassign' && <Alert type="warning" className="mt-3">{rfq.assignedSeller?.company} will lose access to this lead.</Alert>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Response window"><Select value={hours} onChange={(e) => setHours(e.target.value)} options={[{ value: '24', label: '24 hours' }, { value: '48', label: '48 hours' }, { value: '72', label: '72 hours' }, { value: '120', label: '5 days' }]} /></Field>
          <Field label="Assigned by"><Input disabled value={user.name} /></Field>
          <Field label="Internal note (audit trail)" className="sm:col-span-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this seller?" /></Field>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------- Page ---------------- */
export default function RfqDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/admin/rfqs/${id}`);
  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => { if (data && notes === null) setNotes(data.rfq.adminNotes || ''); }, [data, notes]);
  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { rfq, quotes, messages, order, fill } = data;
  const overdue = rfq.status === 'assigned' && new Date(rfq.responseDueAt) < Date.now();

  const act = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: 'success', t: ok }); setConfirm(null); await reload(); } catch (x) { setMsg({ type: 'error', t: errMsg(x) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader back={<Link to="/queue" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> Queue</Link>}
        title={rfq.title} subtitle={<span className="flex flex-wrap items-center gap-2">{rfq.number} <StatusBadge status={rfq.status} /> {overdue && <Badge color="red">Response overdue</Badge>}</span>}
        actions={<>
          {rfq.status === 'assigned' && can('assign') && <Button variant="outline" onClick={() => setConfirm('unassign')}><UserMinus className="h-4 w-4" /> Pull back to queue</Button>}
          {!['closed', 'cancelled', 'accepted'].includes(rfq.status) && <Button variant="ghost" onClick={() => setConfirm('close')}>Close RFQ</Button>}
        </>} />
      {msg && <Alert type={msg.type} className="mb-5">{msg.t}</Alert>}

      {rfq.assignedSeller && (
        <Card className="card-pad mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-forest p-2.5 text-gold-light"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-medium">Assigned seller</p>
              <Link to={`/sellers/${rfq.assignedSeller._id}`} className="font-medium text-forest hover:underline">{rfq.assignedSeller.company}</Link>
              <p className="text-xs text-ink-medium">by {rfq.assignedBy?.name} · {dateTime(rfq.assignedAt)}</p>
            </div>
          </div>
          {rfq.status === 'assigned' && <p className={cx('flex items-center gap-1.5 text-sm font-medium', overdue ? 'text-danger' : 'text-ink')}><Clock className="h-4 w-4" />{overdue ? 'Overdue — reassign below' : timeLeft(rfq.responseDueAt)}</p>}
        </Card>
      )}

      {['pending', 'assigned'].includes(rfq.status) && can('assign') && <div className="mb-6"><SellerPanel rfq={rfq} onDone={() => { setMsg({ type: 'success', t: 'Lead pushed. The seller has been notified.' }); reload(); }} /></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="card-pad">
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs uppercase tracking-wider text-ink-medium">Buyer</p><Link to={`/buyers/${rfq.buyer._id}`} className="font-medium text-forest hover:underline">{rfq.buyer.company || rfq.buyer.name}</Link><p className="text-xs text-ink-medium">{rfq.buyer.email}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-ink-medium">Category</p><p className="font-medium">{rfq.category}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-ink-medium">Deadline</p><p className="font-medium">{date(rfq.deadline)}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-ink-medium">Ship to</p><p className="font-medium">{[rfq.destination?.city, rfq.destination?.state, rfq.destination?.zip].filter(Boolean).join(', ') || '—'} · {rfq.incoterm}</p></div>
            </div>
            {rfq.description && <p className="mt-4 whitespace-pre-line border-t border-mist pt-4 text-sm">{rfq.description}</p>}
            {rfq.budget ? <p className="mt-2 text-sm text-ink-medium">Budget: <b className="text-ink">{usd(rfq.budget, 0)}</b></p> : null}
            {rfq.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{rfq.attachments.map((a) => <a key={a.url} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-cream px-2.5 py-1 text-xs text-forest"><Paperclip className="h-3 w-3" />{a.name}</a>)}</div>}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Items</h3></div>
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Target</th><th className="text-right">CBM/u</th><th className="text-right">kg/u</th></tr></thead>
              <tbody>{rfq.items.map((i) => <tr key={i._id}><td>{i.name}{i.specs && <span className="block text-xs text-ink-medium">{i.specs}</span>}</td><td className="text-right">{num(i.quantity)} {i.unit}</td><td className="text-right">{i.targetUnitPrice ? usd(i.targetUnitPrice) : '—'}</td><td className="text-right">{i.cbmPerUnit || '—'}</td><td className="text-right">{i.weightKgPerUnit || '—'}</td></tr>)}</tbody>
            </table></div>
          </Card>

          {quotes.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Quotations</h3></div>
              <table className="table">
                <thead><tr><th>Seller</th><th className="text-right">Total</th><th>Rounds</th><th>Status</th><th>Sent</th></tr></thead>
                <tbody>{quotes.map((q) => <tr key={q._id}><td>{q.seller?.company}</td><td className="text-right font-medium">{usd(q.total)}</td><td>{q.rounds.length}</td><td><StatusBadge status={q.status} /></td><td className="text-ink-medium">{date(q.createdAt)}</td></tr>)}</tbody>
              </table>
              {order && <p className="border-t border-mist px-6 py-3 text-sm">Order <Link to={`/orders/${order._id}`} className="font-medium text-forest hover:underline">{order.number}</Link> · {usd(order.total)} · <StatusBadge status={order.paymentStatus} /></p>}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-mist px-6 py-3"><MessageSquare className="h-4 w-4 text-gold" /><h3 className="text-lg text-forest">Buyer ↔ seller messages</h3><span className="text-xs text-ink-medium">(read-only)</span></div>
            <div className="max-h-96 space-y-2 overflow-y-auto bg-cream/40 p-4">
              {!messages.length && <p className="py-6 text-center text-sm text-ink-medium">No messages.</p>}
              {messages.map((m) => (
                <div key={m._id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-beige">
                  <p className="text-[11px] text-ink-medium"><b className="capitalize text-ink">{m.sender?.role}</b> · {m.sender?.company || m.sender?.name} · {dateTime(m.createdAt)}</p>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.attachment?.url && <a href={fileUrl(m.attachment.url)} target="_blank" rel="noreferrer" className="text-xs text-muted underline">{m.attachment.name}</a>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {fill && <ContainerFill items={rfq.items} type={rfq.containerType} readOnly />}
          <Card className="card-pad">
            <h3 className="mb-3 flex items-center gap-2 text-lg text-forest"><History className="h-4 w-4 text-gold" /> Audit trail</h3>
            <ol className="relative space-y-4 border-l-2 border-mist pl-5">
              {[...rfq.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white', ['assigned', 'reassigned'].includes(h.action) ? 'bg-gold' : h.action === 'unassigned' ? 'bg-danger' : 'bg-forest')} />
                  <p className="text-sm font-medium">{ACTION_LABEL[h.action] || h.action}{h.seller && <> → {h.seller.company || h.seller.name}</>}</p>
                  <p className="text-xs text-ink-medium">{h.by?.name ? `${h.by.name} (${h.by.role})` : ''} · {dateTime(h.at)}</p>
                  {h.note && <p className="mt-0.5 text-xs italic text-ink-medium">“{h.note}”</p>}
                </li>
              ))}
            </ol>
          </Card>
          <Card className="card-pad">
            <h3 className="mb-2 text-lg text-forest">Internal notes</h3>
            <Textarea rows={4} value={notes || ''} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to admins only" />
            <Button variant="outline" size="sm" className="mt-2" loading={busy} onClick={() => act(() => api.patch(`/admin/rfqs/${id}`, { adminNotes: notes }), 'Notes saved.')}>Save notes</Button>
          </Card>
        </div>
      </div>

      <Modal open={confirm === 'unassign'} onClose={() => setConfirm(null)} title="Pull lead back to queue?"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={busy} onClick={() => act(() => api.post(`/admin/rfqs/${id}/unassign`), 'RFQ returned to the pending queue.')}><Unlock className="h-4 w-4" /> Unassign</Button></>}>
        <p className="text-sm text-ink-medium">{rfq.assignedSeller?.company} will lose access. The RFQ goes back to Unassigned.</p>
      </Modal>
      <Modal open={confirm === 'close'} onClose={() => setConfirm(null)} title="Close this RFQ?"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => act(() => api.patch(`/admin/rfqs/${id}`, { close: true }), 'RFQ closed.')}>Close RFQ</Button></>}>
        <p className="text-sm text-ink-medium">Use for spam, duplicates or requests Ranavista can’t serve.</p>
      </Modal>
    </>
  );
}

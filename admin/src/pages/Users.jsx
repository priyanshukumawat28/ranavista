import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, Building2, CheckCircle2, FileText, Search, Users as UsersIcon, XCircle } from 'lucide-react';
import api, { errMsg, fileUrl } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { CATEGORIES, date, usd } from '../lib/format';
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Stars, StatusBadge, Tabs, Textarea, cx } from '../components/ui';

const planName = (u) => (u.subscription?.status === 'active' ? (u.subscription.plan || '').replace(/^(buyer|seller)_/, '') : u.role === 'seller' ? 'starter' : 'basic');

export function UserList({ role }) {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const approval = role === 'seller' ? sp.get('approval') ?? 'pending' : '';
  const qs = new URLSearchParams({ role, ...(approval && { approval }), ...(sp.get('q') && { q: sp.get('q') }), ...(sp.get('status') && { status: sp.get('status') }) }).toString();
  const { data, loading } = useFetch(`/admin/users?${qs}`);
  return (
    <>
      <PageHeader title={role === 'seller' ? 'Sellers' : 'Buyers'} subtitle={role === 'seller' ? 'Verify manufacturers before they can receive leads.' : 'Companies posting RFQs.'} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {role === 'seller' ? (
          <Tabs value={approval} onChange={(v) => setSp(v ? { approval: v } : { approval: '' })} tabs={[{ value: 'pending', label: 'Awaiting verification' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]} />
        ) : <div />}
        <form onSubmit={(e) => { e.preventDefault(); const n = new URLSearchParams(sp); q ? n.set('q', q) : n.delete('q'); setSp(n); }} className="relative md:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-medium" /><Input className="pl-9" placeholder="Name, email or company" value={q} onChange={(e) => setQ(e.target.value)} /></form>
      </div>
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.length ? <Empty icon={role === 'seller' ? Building2 : UsersIcon} title="No accounts here" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Company</th><th>Contact</th>{role === 'seller' ? <><th>Country</th><th>Categories</th><th>Rating</th><th>Verification</th></> : <th>Location</th>}<th>Plan</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u._id}>
                    <td><Link to={`/${role}s/${u._id}`} className="font-medium text-forest hover:underline">{u.company || u.name}</Link></td>
                    <td>{u.name}<span className="block text-xs text-ink-medium">{u.email}</span></td>
                    {role === 'seller' ? (
                      <>
                        <td>{u.seller?.country}</td>
                        <td className="max-w-[220px] text-xs text-ink-medium">{u.seller?.categories?.join(', ')}</td>
                        <td>{u.seller?.ratingCount ? <span className="flex items-center gap-1"><Stars value={u.seller.rating} size="h-3 w-3" /><span className="text-xs">({u.seller.ratingCount})</span></span> : '—'}</td>
                        <td><StatusBadge status={u.seller?.approval} labels={{ pending: 'Pending' }} /></td>
                      </>
                    ) : <td>{[u.address?.city, u.address?.state].filter(Boolean).join(', ') || '—'}</td>}
                    <td className="capitalize">{planName(u)}</td>
                    <td>{u.status === 'suspended' ? <Badge color="red">Suspended</Badge> : <Badge color="success">Active</Badge>}{!u.emailVerified && <Badge color="amber" className="ml-1">Unverified email</Badge>}</td>
                    <td className="whitespace-nowrap text-ink-medium">{date(u.createdAt)}</td>
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

export function UserDetail({ role }) {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch(`/admin/users/${id}`);
  const { data: plans } = useFetch('/admin/plans');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { user: u, orders, rfqs, reviews, ledger } = data;
  const isSeller = u.role === 'seller';

  const act = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setModal(null); setMsg({ type: 'success', t: ok }); await reload(); } catch (x) { setMsg({ type: 'error', t: errMsg(x) }); } finally { setBusy(false); }
  };
  const L = (k) => ledger.find((x) => x._id === k)?.total || 0;

  return (
    <>
      <PageHeader back={<Link to={`/${role}s`} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> {isSeller ? 'Sellers' : 'Buyers'}</Link>}
        title={u.company || u.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{u.name} · {u.email}{u.phone && ` · ${u.phone}`} {isSeller && <StatusBadge status={u.seller.approval} labels={{ pending: 'Pending verification' }} />}{u.status === 'suspended' && <Badge color="red">Suspended</Badge>}</span>}
        actions={<>
          {isSeller && can('approve') && u.seller.approval !== 'approved' && <Button onClick={() => act(() => api.post(`/admin/users/${id}/approval`, { decision: 'approved' }), 'Seller approved and notified.')} loading={busy}><CheckCircle2 className="h-4 w-4" /> Approve seller</Button>}
          {isSeller && can('approve') && u.seller.approval !== 'rejected' && <Button variant="outline" onClick={() => { setForm({ reason: '' }); setModal('reject'); }}><XCircle className="h-4 w-4" /> {u.seller.approval === 'approved' ? 'Revoke' : 'Reject'}</Button>}
          {can('suspend') && <Button variant="ghost" onClick={() => setModal('status')}><Ban className="h-4 w-4" /> {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}</Button>}
        </>} />
      {msg && <Alert type={msg.type} className="mb-5">{msg.t}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {(isSeller ? [['Paid out', 'released'], ['On hold', 'held'], ['Refunded', 'refunded']] : [['Spent (released)', 'released'], ['In escrow', 'held'], ['Refunded', 'refunded']]).map(([l, k]) => (
              <div key={k} className="card card-pad"><p className="text-xs uppercase tracking-wider text-ink-medium">{l}</p><p className="mt-1 font-serif text-2xl">{usd(L(k) + (k === 'held' ? L('disputed') : 0))}</p></div>
            ))}
          </div>
          {isSeller && (
            <Card className="card-pad">
              <h3 className="text-lg text-forest">Company</h3>
              <p className="mt-2 whitespace-pre-line text-sm">{u.seller.description || <span className="text-ink-medium">No description.</span>}</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <p><span className="text-ink-medium">Country:</span> {u.seller.country}</p>
                <p><span className="text-ink-medium">Established:</span> {u.seller.yearEstablished || '—'}</p>
                <p><span className="text-ink-medium">Website:</span> {u.seller.website ? <a href={u.seller.website} target="_blank" rel="noreferrer" className="text-muted underline">{u.seller.website.replace(/^https?:\/\//, '')}</a> : '—'}</p>
                <p><span className="text-ink-medium">Payouts:</span> {u.seller.payoutsEnabled ? '✓ Connected' : 'Not connected'}</p>
                <p><span className="text-ink-medium">Leads:</span> {u.seller.leadsReceived || 0} received / {u.seller.leadsQuoted || 0} quoted</p>
                <p className="flex items-center gap-1"><span className="text-ink-medium">Rating:</span> <Stars value={u.seller.rating} size="h-3.5 w-3.5" /> ({u.seller.ratingCount})</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {u.seller.categories.map((c) => <Badge key={c} color="green">{c}</Badge>)}
                {can('assign') && <button onClick={() => { setForm({ categories: u.seller.categories }); setModal('cats'); }} className="text-xs text-muted underline">Edit</button>}
              </div>
              {u.seller.rejectionReason && <Alert type="warning" className="mt-4">Rejection reason: {u.seller.rejectionReason}</Alert>}
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">Orders</h3></div>
            {!orders.length ? <p className="p-6 text-sm text-ink-medium">No orders.</p> : (
              <table className="table"><tbody>{orders.map((o) => <tr key={o._id}><td><Link to={`/orders/${o._id}`} className="font-medium text-forest hover:underline">{o.number}</Link></td><td className="text-right">{usd(isSeller ? o.sellerPayout : o.total)}</td><td><StatusBadge status={o.paymentStatus} /></td><td><StatusBadge status={o.fulfillment} /></td><td className="text-ink-medium">{date(o.createdAt)}</td></tr>)}</tbody></table>
            )}
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-mist px-6 py-3"><h3 className="text-lg text-forest">{isSeller ? 'Leads received' : 'RFQs posted'}</h3></div>
            {!rfqs.length ? <p className="p-6 text-sm text-ink-medium">None yet.</p> : (
              <table className="table"><tbody>{rfqs.map((r) => <tr key={r._id}><td><Link to={`/rfqs/${r._id}`} className="font-medium text-forest hover:underline">{r.number}</Link></td><td className="max-w-xs truncate">{r.title}</td><td>{r.category}</td><td><StatusBadge status={r.status} /></td><td className="text-ink-medium">{date(r.createdAt)}</td></tr>)}</tbody></table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="card-pad">
            <p className="eyebrow">Subscription</p>
            <p className="mt-2 font-serif text-2xl capitalize text-forest">{planName(u)}</p>
            <p className="text-sm text-ink-medium">{u.subscription?.status === 'active' ? `Active${u.subscription.currentPeriodEnd ? ` until ${date(u.subscription.currentPeriodEnd)}` : ''}${u.subscription.assignedByAdmin ? ' · set by admin' : ''}` : 'Free tier'}</p>
            {can('money') && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setForm({ planKey: '', until: '' }); setModal('plan'); }}>Assign plan</Button>
                {u.subscription?.status === 'active' && <Button size="sm" variant="ghost" onClick={() => act(() => api.post(`/admin/users/${id}/subscription`, { action: 'cancel' }), 'Subscription cancelled.')}>Cancel</Button>}
              </div>
            )}
          </Card>
          {isSeller && (
            <Card className="card-pad">
              <p className="eyebrow">Verification documents</p>
              {!u.seller.documents?.length ? <p className="mt-2 text-sm text-ink-medium">None uploaded.</p> : (
                <ul className="mt-3 space-y-2">{u.seller.documents.map((d) => <li key={d.url}><a href={fileUrl(d.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-forest hover:underline"><FileText className="h-4 w-4 text-gold" />{d.name}</a></li>)}</ul>
              )}
            </Card>
          )}
          <Card className="card-pad text-sm">
            <p className="eyebrow">Account</p>
            <div className="mt-2 space-y-1">
              <p><span className="text-ink-medium">Email verified:</span> {u.emailVerified ? 'Yes' : 'No'}</p>
              <p><span className="text-ink-medium">Joined:</span> {date(u.createdAt)}</p>
              <p><span className="text-ink-medium">Last login:</span> {date(u.lastLoginAt)}</p>
              {u.address && <p><span className="text-ink-medium">Address:</span> {[u.address.line1, u.address.city, u.address.state, u.address.zip, u.address.country].filter(Boolean).join(', ')}</p>}
            </div>
          </Card>
          {reviews.length > 0 && (
            <Card className="card-pad">
              <p className="eyebrow">Reviews received</p>
              <ul className="mt-3 space-y-3">{reviews.map((r) => <li key={r._id} className={cx('text-sm', r.hidden && 'opacity-50')}><Stars value={r.rating} size="h-3.5 w-3.5" /><p>{r.comment}</p><p className="text-xs text-ink-medium">— {r.from?.company || r.from?.name}</p></li>)}</ul>
            </Card>
          )}
        </div>
      </div>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Reject verification"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => act(() => api.post(`/admin/users/${id}/approval`, { decision: 'rejected', reason: form.reason }), 'Seller rejected and notified.')}>Reject</Button></>}>
        <Field label="Reason (sent to seller)"><Textarea rows={3} value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} placeholder="e.g. Please upload a valid export license (IEC)." /></Field>
      </Modal>
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title={u.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant={u.status === 'suspended' ? 'primary' : 'danger'} loading={busy} onClick={() => act(() => api.post(`/admin/users/${id}/status`, { status: u.status === 'suspended' ? 'active' : 'suspended', reason: form.reason }), 'Account updated.')}>{u.status === 'suspended' ? 'Reactivate' : 'Suspend'}</Button></>}>
        <Field label="Reason (audit log)"><Textarea rows={2} value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} /></Field>
      </Modal>
      <Modal open={modal === 'plan'} onClose={() => setModal(null)} title="Assign a plan"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} disabled={!form.planKey} onClick={() => act(() => api.post(`/admin/users/${id}/subscription`, form), 'Plan assigned.')}>Assign</Button></>}>
        <p className="mb-4 text-sm text-ink-medium">Use for comps, trials or offline-invoiced customers. Stripe isn’t charged.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan"><Select value={form.planKey || ''} onChange={(e) => setForm({ ...form, planKey: e.target.value })} options={(plans || []).filter((p) => p.audience === u.role).map((p) => ({ value: p.key, label: `${p.name} ($${p.priceMonthly}/mo)` }))} placeholder="Choose" /></Field>
          <Field label="Active until"><Input type="date" value={form.until || ''} onChange={(e) => setForm({ ...form, until: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={modal === 'cats'} onClose={() => setModal(null)} title="Seller categories"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => act(() => api.patch(`/admin/users/${id}/categories`, { categories: form.categories }), 'Categories updated.')}>Save</Button></>}>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setForm({ categories: form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c] })} className={cx('rounded-full border px-3 py-1.5 text-xs', form.categories?.includes(c) ? 'border-forest bg-forest text-white' : 'border-line')}>{c}</button>)}
        </div>
      </Modal>
    </>
  );
}

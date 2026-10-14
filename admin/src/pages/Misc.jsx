import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Eye, EyeOff, Mail, Pencil, Plus, ScrollText, Star, UserPlus } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../lib/auth';
import { CATEGORIES, date, dateTime, usd, usd0 } from '../lib/format';
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Stars, Stat, Tabs, Textarea, cx } from '../components/ui';
import Bars from '../components/Bars';

/* ======================= PLANS / SUBSCRIPTIONS ======================= */
const blankPlan = { key: '', audience: 'buyer', name: '', tagline: '', priceMonthly: 0, priceYearly: 0, features: [], limits: { rfqsPerMonth: 3, categories: 2, priority: 0 }, stripePriceId: '', highlighted: false, active: true, sort: 9 };

export function Plans() {
  const { can } = useAuth();
  const { data, loading, reload } = useFetch('/admin/plans');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const body = { ...edit, features: typeof edit.features === 'string' ? edit.features.split('\n').map((s) => s.trim()).filter(Boolean) : edit.features };
    try { edit._id ? await api.patch(`/admin/plans/${edit._id}`, body) : await api.post('/admin/plans', body); setEdit(null); reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const set = (k, v) => setEdit({ ...edit, [k]: v });
  const setL = (k, v) => setEdit({ ...edit, limits: { ...edit.limits, [k]: Number(v) } });
  return (
    <>
      <PageHeader title="Subscription plans" subtitle="Buyer tiers (Basic / Growth / Enterprise) and seller tiers (Starter / Professional / Enterprise), billed through Stripe."
        actions={can('editPlans') && <Button onClick={() => setEdit({ ...blankPlan, features: '' })}><Plus className="h-4 w-4" /> New plan</Button>} />
      {loading ? <PageLoader /> : ['buyer', 'seller'].map((aud) => (
        <div key={aud} className="mb-8">
          <h2 className="mb-3 text-xl capitalize text-forest">{aud} plans</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {data.filter((p) => p.audience === aud).map((p) => (
              <Card key={p._id} className={cx('card-pad', !p.active && 'opacity-60')}>
                <div className="flex items-start justify-between"><div><h3 className="text-xl text-forest">{p.name}</h3><p className="font-mono text-[11px] text-ink-medium">{p.key}</p></div>{can('editPlans') && <button onClick={() => setEdit({ ...p, features: p.features.join('\n') })} className="rounded-md p-1.5 hover:bg-mist" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}</div>
                <p className="mt-3"><span className="font-serif text-3xl">{usd0(p.priceMonthly)}</span><span className="text-sm text-ink-medium"> /mo</span></p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge color="green">{p.subscribers} active</Badge>
                  <Badge color="gold">{usd0(p.subscribers * p.priceMonthly)} MRR</Badge>
                  {!p.active && <Badge color="gray">Hidden</Badge>}
                  {p.priceMonthly > 0 && !p.stripePriceId && <Badge color="red">No Stripe price</Badge>}
                </div>
                <p className="mt-3 text-xs text-ink-medium">{aud === 'buyer' ? `RFQs/month: ${p.limits.rfqsPerMonth === -1 ? 'unlimited' : p.limits.rfqsPerMonth}` : `Categories: ${p.limits.categories === -1 ? 'unlimited' : p.limits.categories} · priority ${p.limits.priority}`}</p>
              </Card>
            ))}
          </div>
        </div>
      ))}
      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${edit.name}` : 'New plan'}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save plan</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {err && <Alert type="error" className="sm:col-span-2">{err}</Alert>}
            <Field label="Name"><Input value={edit.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Key" hint="Unique, e.g. buyer_growth"><Input disabled={!!edit._id} value={edit.key} onChange={(e) => set('key', e.target.value)} /></Field>
            <Field label="Audience"><Select disabled={!!edit._id} value={edit.audience} onChange={(e) => set('audience', e.target.value)} options={['buyer', 'seller']} /></Field>
            <Field label="Tagline"><Input value={edit.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Price / month (USD)"><Input type="number" value={edit.priceMonthly} onChange={(e) => set('priceMonthly', Number(e.target.value))} /></Field>
            <Field label="Price / year (USD)"><Input type="number" value={edit.priceYearly} onChange={(e) => set('priceYearly', Number(e.target.value))} /></Field>
            <Field label="Stripe Price ID" hint="price_… from Stripe → Products" className="sm:col-span-2"><Input value={edit.stripePriceId || ''} onChange={(e) => set('stripePriceId', e.target.value)} /></Field>
            {edit.audience === 'buyer'
              ? <Field label="RFQs per month (-1 = unlimited)"><Input type="number" value={edit.limits.rfqsPerMonth} onChange={(e) => setL('rfqsPerMonth', e.target.value)} /></Field>
              : <Field label="Max categories (-1 = unlimited)"><Input type="number" value={edit.limits.categories} onChange={(e) => setL('categories', e.target.value)} /></Field>}
            <Field label="Assignment priority" hint="Higher = shown first to admins"><Input type="number" value={edit.limits.priority} onChange={(e) => setL('priority', e.target.value)} /></Field>
            <Field label="Features (one per line)" className="sm:col-span-2"><Textarea rows={5} value={edit.features} onChange={(e) => set('features', e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.highlighted} onChange={(e) => set('highlighted', e.target.checked)} className="accent-forest" /> Highlight as “Most popular”</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => set('active', e.target.checked)} className="accent-forest" /> Visible to customers</label>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ======================= REVENUE ======================= */
export function Revenue() {
  const { data, loading } = useFetch('/admin/revenue');
  if (loading || !data) return <PageLoader />;
  return (
    <>
      <PageHeader title="Revenue" subtitle="Subscriptions are the primary revenue line; platform fees come from completed orders." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MRR" value={usd0(data.mrr)} icon={CreditCard} tone="gold" />
        <Stat label="ARR (run-rate)" value={usd0(data.arr)} />
        <Stat label="Paying subscribers" value={data.paying} hint={`${data.newSubs30} new/updated in 30 days`} tone="blue" />
        <Stat label="Churn (30 days)" value={`${data.churnRate}%`} hint={`${data.churn30} cancellations`} tone="red" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="card-pad xl:col-span-2">
          <h2 className="mb-6 text-lg text-forest">Platform fees — last 12 months</h2>
          <Bars series={data.months.map((m) => ({ label: m.label, value: m.fees }))} valueLabel="Fees" />
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-mist px-6 py-3"><h2 className="text-lg text-forest">By tier</h2></div>
          <table className="table"><tbody>{data.tiers.map((t) => <tr key={t.key}><td>{t.name}<span className="block text-xs capitalize text-ink-medium">{t.audience}</span></td><td className="text-right">{t.subscribers}</td><td className="text-right font-medium">{usd0(t.mrr)}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-mist px-6 py-3"><h2 className="text-lg text-forest">Paid volume by category</h2></div>
        {!data.byCategory.length ? <p className="p-6 text-sm text-ink-medium">No paid orders yet.</p> : (
          <table className="table"><tbody>{data.byCategory.map((c) => <tr key={c._id}><td>{c._id}</td><td className="text-right">{c.n} orders</td><td className="text-right font-medium">{usd0(c.gmv)}</td></tr>)}</tbody></table>
        )}
      </Card>
    </>
  );
}

/* ======================= REVIEWS ======================= */
export function Reviews() {
  const { data, loading, reload } = useFetch('/admin/reviews');
  const toggle = async (r) => { await api.post(`/admin/reviews/${r._id}/hide`, { hidden: !r.hidden }); reload(); };
  return (
    <>
      <PageHeader title="Reviews" subtitle="Hide abusive or fake reviews. Hidden reviews don’t count toward seller ratings on the next review." />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.length ? <Empty icon={Star} title="No reviews yet" /> : (
          <table className="table">
            <thead><tr><th>Rating</th><th>Comment</th><th>From</th><th>To</th><th>Order</th><th></th></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r._id} className={cx(r.hidden && 'opacity-50')}>
                <td><Stars value={r.rating} size="h-3.5 w-3.5" /></td>
                <td className="max-w-sm text-sm">{r.comment}</td>
                <td>{r.from?.company || r.from?.name}<span className="block text-xs capitalize text-ink-medium">{r.from?.role}</span></td>
                <td>{r.to?.company || r.to?.name}</td>
                <td>{r.order?.number}</td>
                <td><Button size="sm" variant="ghost" onClick={() => toggle(r)}>{r.hidden ? <><Eye className="h-3.5 w-3.5" /> Show</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}</Button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/* ======================= ENQUIRIES ======================= */
export function Enquiries() {
  const { data, loading, reload } = useFetch('/admin/enquiries');
  return (
    <>
      <PageHeader title="Website enquiries" subtitle="Messages from the Contact Us form." />
      <div className="space-y-3">
        {loading ? <PageLoader /> : !data?.length ? <Card><Empty icon={Mail} title="No enquiries" /></Card> : data.map((e) => (
          <Card key={e._id} className={cx('card-pad', e.handled && 'opacity-60')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-medium">{e.name} {e.company && <span className="text-ink-medium">· {e.company}</span>}</p><a href={`mailto:${e.email}`} className="text-sm text-muted underline">{e.email}</a>{e.phone && <span className="text-sm text-ink-medium"> · {e.phone}</span>}</div>
              <div className="flex items-center gap-2"><span className="text-xs text-ink-medium">{dateTime(e.createdAt)}</span>{!e.handled ? <Button size="sm" variant="outline" onClick={() => api.post(`/admin/enquiries/${e._id}/handled`).then(reload)}>Mark handled</Button> : <Badge color="success">Handled</Badge>}</div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{e.message}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ======================= AUDIT LOG ======================= */
export function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, loading } = useFetch(`/admin/audit?page=${page}${action ? `&action=${action}` : ''}`);
  const link = (l) => ({ RFQ: `/rfqs/${l.entityId}`, Order: `/orders/${l.entityId}`, Dispute: `/disputes/${l.entityId}` }[l.entity]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin action: which admin pushed which RFQ to which seller and when, every release, refund and approval." />
      <Tabs value={action} onChange={(v) => { setAction(v); setPage(1); }} tabs={[{ value: '', label: 'All' }, { value: 'rfq', label: 'Lead routing' }, { value: 'order', label: 'Money' }, { value: 'seller', label: 'Verification' }, { value: 'subscription', label: 'Subscriptions' }, { value: 'team', label: 'Team' }]} />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.list.length ? <Empty icon={ScrollText} title="No entries" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>{data.list.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap text-ink-medium">{dateTime(l.createdAt)}</td>
                  <td>{l.admin?.name}<span className="block text-xs capitalize text-ink-medium">{l.admin?.adminRole}</span></td>
                  <td><code className="rounded bg-mist px-1.5 py-0.5 text-xs">{l.action}</code></td>
                  <td className="text-sm">
                    {link(l) ? <Link to={link(l)} className="text-forest hover:underline">{l.meta?.number || `${l.entity} ${l.entityId.slice(-6)}`}</Link> : `${l.entity} ${l.entityId?.slice(-6) || ''}`}
                    {l.meta?.seller && <> → <b>{l.meta.seller}</b></>}
                    {l.meta?.amount && <> · {typeof l.meta.amount === 'number' ? usd(l.meta.amount) : l.meta.amount}</>}
                    {(l.meta?.note || l.meta?.reason) && <span className="block text-xs italic text-ink-medium">“{l.meta.note || l.meta.reason}”</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      {data?.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}

/* ======================= ADMIN TEAM ======================= */
const ROLES = [
  { value: 'super', label: 'Super Admin — everything' },
  { value: 'finance', label: 'Finance — money, plans, revenue' },
  { value: 'support', label: 'Support — verification, routing, disputes' },
  { value: 'category', label: 'Category Manager — routing in own categories' },
];
export function Team() {
  const { user } = useAuth();
  const { data, loading, reload } = useFetch('/admin/team');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { edit._id ? await api.patch(`/admin/team/${edit._id}`, edit) : await api.post('/admin/team', edit); setEdit(null); reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Admin team" subtitle="Role-based access for your staff." actions={<Button onClick={() => setEdit({ name: '', email: '', password: '', adminRole: 'support', adminCategories: [] })}><UserPlus className="h-4 w-4" /> Add admin</Button>} />
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Categories</th><th>Status</th><th>Last login</th><th></th></tr></thead>
            <tbody>{data.map((a) => (
              <tr key={a._id}>
                <td>{a.name}{String(a._id) === String(user._id) && <Badge color="gold" className="ml-2">You</Badge>}<span className="block text-xs text-ink-medium">{a.email}</span></td>
                <td className="capitalize">{a.adminRole}</td>
                <td className="text-xs text-ink-medium">{a.adminRole === 'category' ? (a.adminCategories?.join(', ') || 'All') : '—'}</td>
                <td>{a.status === 'suspended' ? <Badge color="red">Disabled</Badge> : <Badge color="success">Active</Badge>}</td>
                <td className="text-ink-medium">{date(a.lastLoginAt)}</td>
                <td><Button size="sm" variant="ghost" onClick={() => setEdit({ ...a, password: '' })}><Pencil className="h-3.5 w-3.5" /> Edit</Button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${edit.name}` : 'Add admin'}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            {err && <Alert type="error">{err}</Alert>}
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            {!edit._id && <Field label="Email"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>}
            <Field label={edit._id ? 'New password (optional)' : 'Temporary password'}><Input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            <Field label="Role"><Select value={edit.adminRole} onChange={(e) => setEdit({ ...edit, adminRole: e.target.value })} options={ROLES} /></Field>
            {edit.adminRole === 'category' && (
              <div><span className="label">Categories (none = all)</span><div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button type="button" key={c} onClick={() => setEdit({ ...edit, adminCategories: edit.adminCategories?.includes(c) ? edit.adminCategories.filter((x) => x !== c) : [...(edit.adminCategories || []), c] })} className={cx('rounded-full border px-2.5 py-1 text-xs', edit.adminCategories?.includes(c) ? 'border-forest bg-forest text-white' : 'border-line')}>{c}</button>)}</div></div>
            )}
            {edit._id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.status === 'suspended'} onChange={(e) => setEdit({ ...edit, status: e.target.checked ? 'suspended' : 'active' })} className="accent-forest" /> Disable this admin</label>}
          </div>
        )}
      </Modal>
    </>
  );
}

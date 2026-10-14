import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, Plus, Trash2, X } from 'lucide-react';
import api, { errMsg, uploadFiles } from '../../lib/api';
import { CATEGORIES, INCOTERMS, UNITS, US_STATES, num, usd } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import ContainerFill from '../../components/ContainerFill';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea, cx } from '../../components/ui';

const DRAFT = 'rv_rfq_draft';
const IN3_TO_M3 = 1.6387064e-5;
const LB_TO_KG = 0.45359237;

const blankItem = () => ({ name: '', specs: '', quantity: '', unit: 'pcs', targetUnitPrice: '', l: '', w: '', h: '', lb: '', cbmPerUnit: '', weightKgPerUnit: '' });

/** Items carry both imperial carton inputs and metric values; metric is what we send. */
function normalize(item, mode) {
  if (mode === 'imperial') {
    const cbm = Number(item.l) * Number(item.w) * Number(item.h) * IN3_TO_M3;
    return { ...item, cbmPerUnit: cbm ? +cbm.toFixed(5) : '', weightKgPerUnit: item.lb ? +(Number(item.lb) * LB_TO_KG).toFixed(3) : '' };
  }
  return item;
}

export default function NewRFQ() {
  const { user } = useAuth();
  const nav = useNavigate();
  const initial = () => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d?.items?.length) return d; } catch { /* ignore */ }
    const deadline = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    return {
      title: '', category: '', description: '', budget: '', deadline, incoterm: 'FOB', containerType: '40ft', mode: 'imperial',
      destination: { city: user.address?.city || '', state: user.address?.state || '', zip: user.address?.zip || '', country: 'United States' },
      items: [blankItem()], attachments: [],
    };
  };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(f)); } catch { /* ignore */ } }, [f]);

  const items = useMemo(() => f.items.map((i) => normalize(i, f.mode)), [f.items, f.mode]);
  const estTotal = items.reduce((s, i) => s + Number(i.targetUnitPrice || 0) * Number(i.quantity || 0), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setDest = (k) => (e) => setF({ ...f, destination: { ...f.destination, [k]: e.target.value } });
  const setItem = (idx, k, v) => setF((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }));
  const addUnits = (idx, n) => setItem(idx, 'quantity', String(Number(f.items[idx].quantity || 0) + n));

  const attach = async (e) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try { const refs = await uploadFiles(e.target.files); setF((s) => ({ ...s, attachments: [...s.attachments, ...refs].slice(0, 5) })); }
    catch (x) { setErr(errMsg(x)); } finally { setUploading(false); e.target.value = ''; }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!items.every((i) => i.name && Number(i.quantity) > 0)) return setErr('Every item needs a name and a quantity.');
    setBusy(true);
    try {
      const payload = {
        title: f.title, category: f.category, description: f.description, budget: f.budget || undefined, deadline: f.deadline, incoterm: f.incoterm,
        containerType: f.containerType, destination: f.destination, attachments: f.attachments,
        items: items.map(({ name, specs, quantity, unit, targetUnitPrice, cbmPerUnit, weightKgPerUnit }) => ({
          name, specs, unit, quantity: Number(quantity), targetUnitPrice: targetUnitPrice ? Number(targetUnitPrice) : undefined,
          cbmPerUnit: Number(cbmPerUnit || 0), weightKgPerUnit: Number(weightKgPerUnit || 0),
        })),
      };
      const { data } = await api.post('/rfqs', payload);
      localStorage.removeItem(DRAFT);
      nav(`/buyer/rfqs/${data._id}?posted=1`);
    } catch (x) {
      setErr(errMsg(x));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Post an RFQ" subtitle="Our sourcing team reviews your request and sends it to one hand-picked, verified seller."
        back={<Link to="/buyer/rfqs" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-medium hover:text-forest"><ArrowLeft className="h-4 w-4" /> My RFQs</Link>} />
      {err && <Alert type="error" className="mb-5">{err} {err.includes('Upgrade') && <Link to="/buyer/subscription" className="link">See plans →</Link>}</Alert>}
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg text-forest sm:col-span-2">1. What do you need?</h2>
            <Field label="RFQ title" className="sm:col-span-2"><Input required value={f.title} onChange={set('title')} placeholder="e.g. Hand-block printed cotton table linens" /></Field>
            <Field label="Category"><Select required value={f.category} onChange={set('category')} options={CATEGORIES} placeholder="Select a category" /></Field>
            <Field label="Quotes needed by"><Input required type="date" value={f.deadline} min={new Date().toISOString().slice(0, 10)} onChange={set('deadline')} /></Field>
            <Field label="Details & requirements" className="sm:col-span-2" hint="Materials, finishes, colors, certifications (OEKO-TEX, FSC, Prop 65), packaging, labeling…">
              <Textarea rows={4} value={f.description} onChange={set('description')} />
            </Field>
            <div className="sm:col-span-2">
              <span className="label">Reference files</span>
              <div className="flex flex-wrap items-center gap-2">
                {f.attachments.map((a, i) => (
                  <span key={a.url} className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs">
                    <Paperclip className="h-3 w-3" />{a.name}
                    <button type="button" onClick={() => setF({ ...f, attachments: f.attachments.filter((_, j) => j !== i) })} aria-label="Remove"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <label className={cx('btn-ghost btn-sm cursor-pointer border border-dashed border-line', uploading && 'opacity-50')}>
                  <Paperclip className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Add photos, specs or tech packs'}
                  <input type="file" multiple className="hidden" onChange={attach} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv" />
                </label>
              </div>
            </div>
          </Card>

          <Card className="card-pad">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg text-forest">2. Items (your RFQ cart)</h2>
              <div className="flex rounded-lg bg-mist p-0.5 text-xs">
                {[['imperial', 'in / lb'], ['metric', 'CBM / kg']].map(([m, l]) => (
                  <button key={m} type="button" onClick={() => setF({ ...f, mode: m })} className={cx('rounded-md px-3 py-1.5', f.mode === m ? 'bg-white text-forest shadow-sm' : 'text-ink-medium')}>{l}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {f.items.map((it, idx) => {
                const n = items[idx];
                return (
                  <div key={idx} className="rounded-xl border border-beige bg-cream/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-gold-dark">Item {idx + 1}</span>
                      {f.items.length > 1 && <button type="button" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== idx) })} className="rounded p-1 text-ink-medium hover:bg-white hover:text-danger" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-6">
                      <Field label="Product" className="sm:col-span-4"><Input required value={it.name} onChange={(e) => setItem(idx, 'name', e.target.value)} placeholder="e.g. Table runner 14×72 in" /></Field>
                      <Field label="Quantity" className="sm:col-span-1"><Input required type="number" min="1" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></Field>
                      <Field label="Unit" className="sm:col-span-1"><Select value={it.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)} options={UNITS} /></Field>
                      <Field label="Specs (optional)" className="sm:col-span-4"><Input value={it.specs} onChange={(e) => setItem(idx, 'specs', e.target.value)} placeholder="Material, size, color, finish" /></Field>
                      <Field label="Target price / unit" className="sm:col-span-2"><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-ink-medium">$</span><Input type="number" min="0" step="0.01" className="pl-7" value={it.targetUnitPrice} onChange={(e) => setItem(idx, 'targetUnitPrice', e.target.value)} /></div></Field>
                      {f.mode === 'imperial' ? (
                        <>
                          <Field label="Carton L × W × H (in)" className="sm:col-span-4">
                            <div className="grid grid-cols-3 gap-2">
                              {['l', 'w', 'h'].map((k) => <Input key={k} type="number" min="0" step="0.1" placeholder={k.toUpperCase()} value={it[k]} onChange={(e) => setItem(idx, k, e.target.value)} />)}
                            </div>
                          </Field>
                          <Field label="Weight / unit (lb)" className="sm:col-span-2"><Input type="number" min="0" step="0.01" value={it.lb} onChange={(e) => setItem(idx, 'lb', e.target.value)} /></Field>
                        </>
                      ) : (
                        <>
                          <Field label="Volume / unit (CBM)" className="sm:col-span-3"><Input type="number" min="0" step="0.0001" value={it.cbmPerUnit} onChange={(e) => setItem(idx, 'cbmPerUnit', e.target.value)} /></Field>
                          <Field label="Weight / unit (kg)" className="sm:col-span-3"><Input type="number" min="0" step="0.01" value={it.weightKgPerUnit} onChange={(e) => setItem(idx, 'weightKgPerUnit', e.target.value)} /></Field>
                        </>
                      )}
                    </div>
                    {(n.cbmPerUnit || n.weightKgPerUnit) && Number(it.quantity) > 0 ? (
                      <p className="mt-2 text-xs text-ink-medium">Line total: {num(n.cbmPerUnit * it.quantity, 2)} CBM · {num(n.weightKgPerUnit * it.quantity)} kg{it.targetUnitPrice ? ` · target ${usd(it.targetUnitPrice * it.quantity)}` : ''}</p>
                    ) : null}
                  </div>
                );
              })}
              <button type="button" onClick={() => setF({ ...f, items: [...f.items, blankItem()] })} className="btn-outline w-full border-dashed"><Plus className="h-4 w-4" /> Add another item</button>
            </div>
          </Card>

          <Card className="card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg text-forest sm:col-span-2">3. Delivery & terms</h2>
            <Field label="Ship to — City"><Input value={f.destination.city} onChange={setDest('city')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State"><Select value={f.destination.state} onChange={setDest('state')} options={US_STATES} placeholder="—" /></Field>
              <Field label="ZIP"><Input value={f.destination.zip} onChange={setDest('zip')} inputMode="numeric" maxLength={10} /></Field>
            </div>
            <Field label="Incoterm" hint="FOB = you arrange ocean freight; DDP = delivered, duties paid"><Select value={f.incoterm} onChange={set('incoterm')} options={INCOTERMS} /></Field>
            <Field label="Total budget (optional)"><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-ink-medium">$</span><Input type="number" min="0" className="pl-7" value={f.budget} onChange={set('budget')} placeholder={estTotal ? num(estTotal) : ''} /></div></Field>
            <Field label="Shipping as" className="sm:col-span-2">
              <Select value={f.containerType} onChange={set('containerType')} options={[{ value: '20ft', label: "Full container — 20'" }, { value: '40ft', label: "Full container — 40'" }, { value: '40ft_hc', label: "Full container — 40' High Cube" }, { value: 'none', label: 'Not sure / LCL / air' }]} />
            </Field>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <ContainerFill items={items} type={f.containerType} onTypeChange={(t) => setF({ ...f, containerType: t })} onAddUnits={addUnits} />
          <Card className="card-pad">
            <div className="flex items-baseline justify-between"><span className="text-sm text-ink-medium">Target value</span><span className="font-serif text-2xl">{usd(estTotal)}</span></div>
            <p className="mt-1 text-xs text-ink-medium">{items.length} item{items.length > 1 ? 's' : ''} · {num(items.reduce((s, i) => s + Number(i.quantity || 0), 0))} units</p>
            <Button loading={busy} size="lg" className="mt-5 w-full">Submit RFQ for review</Button>
            <p className="mt-3 text-center text-xs text-ink-medium">Your draft is saved automatically on this device.</p>
          </Card>
        </aside>
      </form>
    </>
  );
}

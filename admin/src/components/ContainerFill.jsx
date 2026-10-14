import { Box, Lightbulb, Plus, Scale } from 'lucide-react';
import { CONTAINERS, containerFill } from '../lib/container';
import { cbmToCuFt, kgToLb, num } from '../lib/format';
import { cx } from './ui';

function Bar({ pct, label, sub, icon: Icon }) {
  const p = Math.min(100, pct);
  const color = pct > 100 ? 'bg-danger' : pct >= 85 ? 'bg-success' : pct >= 50 ? 'bg-gold' : 'bg-sage';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-ink"><Icon className="h-3.5 w-3.5 text-gold" />{label}</span>
        <span className={cx('font-semibold', pct > 100 ? 'text-danger' : 'text-ink')}>{num(pct, 1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist"><div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${p}%` }} /></div>
      <p className="mt-1 text-[11px] text-ink-medium">{sub}</p>
    </div>
  );
}

/**
 * Container Fill Optimizer — CBM + weight based.
 * items: [{ name, quantity, cbmPerUnit, weightKgPerUnit }]
 */
export default function ContainerFill({ items, type, onTypeChange, onAddUnits, readOnly }) {
  const f = containerFill(items, type === 'none' ? '40ft' : type);
  const fillW = Math.min(100, f.fillPct);
  const status = f.over
    ? { t: 'Over capacity — split the order or choose a bigger container', c: 'text-danger' }
    : f.fillPct >= 85 ? { t: 'Great — container is well utilized', c: 'text-success' }
    : f.fillPct >= 50 ? { t: 'Room to add more and lower your landed cost per unit', c: 'text-gold-dark' }
    : { t: 'Lots of empty space — consider consolidating more items', c: 'text-ink-medium' };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-mist bg-gradient-to-br from-forest to-forest-700 p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold-light">Container fill planner</p>
            <p className="mt-1 font-serif text-3xl">{num(f.fillPct, 1)}%<span className="ml-2 font-sans text-sm text-white/60">full · {f.limiting}-limited</span></p>
          </div>
          {!readOnly && (
            <div className="flex rounded-lg bg-white/10 p-0.5 text-xs">
              {Object.entries(CONTAINERS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => onTypeChange?.(k)} className={cx('rounded-md px-2.5 py-1.5 transition', (type === k || (type === 'none' && k === '40ft')) ? 'bg-gold text-white' : 'text-white/75 hover:text-white')}>
                  {v.label.replace(' Standard', '')}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Container illustration */}
        <div className="relative mt-4 h-14 overflow-hidden rounded-md border-2 border-white/30 bg-white/5">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/70 to-gold transition-all duration-700" style={{ width: `${fillW}%` }} />
          <div className="absolute inset-0 flex">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="flex-1 border-r border-white/10" />)}
          </div>
          <div className="absolute inset-y-0 right-0 w-2 bg-white/20" />
        </div>
        <p className={cx('mt-3 text-xs', f.over ? 'text-red-200' : 'text-white/75')}>{status.t}</p>
      </div>
      <div className="space-y-4 p-5">
        <Bar pct={f.volPct} icon={Box} label="Volume" sub={`${num(f.cbm, 2)} of ${f.c.cbm} CBM · ${num(cbmToCuFt(f.cbm))} of ${num(cbmToCuFt(f.c.cbm))} cu ft`} />
        <Bar pct={f.wtPct} icon={Scale} label="Weight" sub={`${num(f.kg)} of ${num(f.c.maxKg)} kg · ${num(kgToLb(f.kg))} lb`} />
        {f.recommended !== (type === 'none' ? '40ft' : type) && f.cbm > 0 && (
          <p className="rounded-lg bg-cream px-3 py-2 text-xs text-ink">
            Recommended: <b>{f.recommended === 'multiple' ? 'more than one container' : CONTAINERS[f.recommended].label}</b>
          </p>
        )}
        {!readOnly && !f.over && f.suggestions.length > 0 && f.fillPct > 0 && (
          <div className="rounded-xl border border-dashed border-gold/50 bg-gold/5 p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gold-dark"><Lightbulb className="h-3.5 w-3.5" /> Add more to optimize</p>
            <ul className="space-y-1.5">
              {f.suggestions.slice(0, 4).map((s) => (
                <li key={s.idx} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-ink">Up to <b>{num(s.extraUnits)}</b> more × {s.name}</span>
                  {onAddUnits && (
                    <button type="button" onClick={() => onAddUnits(s.idx, s.extraUnits)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 font-medium text-forest ring-1 ring-beige hover:bg-forest hover:text-white">
                      <Plus className="h-3 w-3" /> Fill
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-ink-medium">Estimates use practical loading capacity (20′ ≈ 28 CBM, 40′ ≈ 58 CBM, 40′ HC ≈ 68 CBM). Final loading plan is confirmed by your seller.</p>
      </div>
    </div>
  );
}

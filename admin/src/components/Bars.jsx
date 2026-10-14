import { useState } from 'react';
import { usd0 } from '../lib/format';

/** Lightweight bar chart (no chart library). series: [{label, value, value2?}] */
export default function Bars({ series, valueLabel = 'GMV', value2Label, height = 180, format = usd0 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...series.map((s) => Math.max(s.value, s.value2 || 0)));
  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-mist" style={{ bottom: `${g * 100}%` }} />)}
        {series.map((s, i) => (
          <div key={s.label} className="relative flex h-full flex-1 items-end justify-center gap-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="w-full max-w-[34px] rounded-t-md bg-forest transition-all hover:bg-forest-600" style={{ height: `${(s.value / max) * 100}%`, minHeight: s.value ? 3 : 0 }} />
            {value2Label && <div className="w-full max-w-[34px] rounded-t-md bg-gold transition-all" style={{ height: `${((s.value2 || 0) / max) * 100}%`, minHeight: s.value2 ? 3 : 0 }} />}
            {hover === i && (
              <div className="absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift">
                <b>{s.label}</b><br />{valueLabel}: {format(s.value)}{value2Label && <><br />{value2Label}: {format(s.value2 || 0)}</>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">{series.map((s) => <span key={s.label} className="flex-1 text-center text-[11px] text-ink-medium">{s.label}</span>)}</div>
      <div className="mt-3 flex gap-4 text-xs text-ink-medium">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-forest" />{valueLabel}</span>
        {value2Label && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" />{value2Label}</span>}
      </div>
    </div>
  );
}

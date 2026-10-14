import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Star, X, XCircle } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin text-gold', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Button({ variant = 'primary', size, loading, children, className, ...rest }) {
  return (
    <button className={cx(`btn-${variant}`, size && `btn-${size}`, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-medium">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }) => <input className={cx('input', className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx('input min-h-[96px]', className)} {...p} />;
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%236B7A78' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")";
export function Select({ className, options = [], placeholder, style, ...p }) {
  return (
    <select className={cx('input appearance-none bg-no-repeat pr-9', className)} style={{ backgroundImage: CHEVRON, backgroundPosition: 'right 0.9rem center', ...style }} {...p}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Card({ className, children, ...p }) {
  return <div className={cx('card', className)} {...p}>{children}</div>;
}

const ALERT = {
  success: ['bg-success/10 text-[#1e7b34] border-success/20', CheckCircle2],
  info: ['bg-muted/10 text-muted border-muted/20', Info],
  warning: ['bg-warning/15 text-[#94640f] border-warning/30', AlertTriangle],
  error: ['bg-danger/10 text-danger border-danger/20', XCircle],
};
export function Alert({ type = 'info', children, className }) {
  const [cls, Icon] = ALERT[type];
  return (
    <div className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)} role={type === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const BADGE = {
  green: 'bg-forest/10 text-forest',
  gold: 'bg-gold/15 text-gold-dark',
  sage: 'bg-sage/20 text-olive',
  blue: 'bg-muted/15 text-muted',
  red: 'bg-danger/10 text-danger',
  amber: 'bg-warning/20 text-[#94640f]',
  gray: 'bg-mist text-ink-medium',
  success: 'bg-success/10 text-[#1e7b34]',
};
export function Badge({ color = 'gray', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', BADGE[color], className)}>{children}</span>;
}

const STATUS = {
  pending: ['gold', 'In review'],
  assigned: ['blue', 'With seller'],
  quoted: ['green', 'Quote received'],
  negotiating: ['amber', 'Negotiating'],
  accepted: ['success', 'Accepted'],
  closed: ['gray', 'Closed'],
  cancelled: ['gray', 'Cancelled'],
  unpaid: ['amber', 'Awaiting payment'],
  held: ['blue', 'Funds held'],
  released: ['success', 'Paid out'],
  refunded: ['gray', 'Refunded'],
  disputed: ['red', 'Disputed'],
  chargeback: ['red', 'Chargeback'],
  awaiting_payment: ['amber', 'Awaiting payment'],
  processing: ['blue', 'In production'],
  shipped: ['gold', 'Shipped'],
  delivered: ['success', 'Delivered'],
  submitted: ['green', 'Submitted'],
  countered: ['amber', 'Counter-offer'],
  revised: ['green', 'Revised'],
  rejected: ['red', 'Rejected'],
  approved: ['success', 'Approved'],
};
export function StatusBadge({ status, labels }) {
  const [c, l] = STATUS[status] || ['gray', status];
  return <Badge color={c}>{labels?.[status] || l}</Badge>;
}

export function Stars({ value = 0, size = 'h-4 w-4', onChange }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} className={cx(!onChange && 'cursor-default')} aria-label={onChange ? `${i} stars` : undefined}>
          <Star className={cx(size, i <= Math.round(value) ? 'fill-gold text-gold' : 'text-line')} />
        </button>
      ))}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={cx('rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-lift sm:rounded-2xl', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-mist bg-white px-6 py-4">
          <h3 className="text-xl text-forest">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-medium hover:bg-mist" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-mist bg-cream/40 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-cream p-4 text-gold"><Icon className="h-7 w-7" /></div>}
      <h3 className="text-lg text-forest">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-medium">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl text-forest sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-medium">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'green' }) {
  const tones = { green: 'bg-forest/10 text-forest', gold: 'bg-gold/15 text-gold-dark', blue: 'bg-muted/15 text-muted', red: 'bg-danger/10 text-danger', sage: 'bg-sage/20 text-olive' };
  return (
    <div className="card card-pad flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-medium">{label}</p>
        <p className="mt-2 truncate font-serif text-3xl text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-medium">{hint}</p>}
      </div>
      {Icon && <div className={cx('rounded-xl p-2.5', tones[tone])}><Icon className="h-5 w-5" /></div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-soft ring-1 ring-beige/80">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cx('whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition', value === t.value ? 'bg-forest text-white' : 'text-ink-medium hover:bg-cream')}>
          {t.label}{t.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 text-xs', value === t.value ? 'bg-white/20' : 'bg-mist')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

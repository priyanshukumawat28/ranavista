import { CalendarClock, FileText, MapPin, Paperclip, Ship } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { date, dateTime, num, usd } from '../lib/format';
import { Card, StatusBadge, cx } from './ui';

export function RfqSummary({ rfq, showBuyer }) {
  return (
    <Card className="card-pad">
      <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={FileText} label="Category" value={rfq.category} />
        <Info icon={CalendarClock} label="Quotes needed by" value={date(rfq.deadline)} />
        <Info icon={MapPin} label="Ship to" value={[rfq.destination?.city, rfq.destination?.state, rfq.destination?.zip].filter(Boolean).join(', ') || rfq.destination?.country || '—'} />
        <Info icon={Ship} label="Terms" value={`${rfq.incoterm}${rfq.containerType !== 'none' ? ` · ${rfq.containerType.replace('_hc', ' HC')} container` : ''}`} />
      </div>
      {showBuyer && rfq.buyer && (
        <p className="mt-4 border-t border-mist pt-4 text-sm text-ink-medium">Buyer: <span className="font-medium text-ink">{rfq.buyer.company || rfq.buyer.name}</span>{rfq.buyer.address?.state ? ` · ${rfq.buyer.address.state}, USA` : ''}</p>
      )}
      {rfq.description && <p className="mt-4 whitespace-pre-line border-t border-mist pt-4 text-sm leading-relaxed text-ink">{rfq.description}</p>}
      {rfq.budget ? <p className="mt-3 text-sm text-ink-medium">Budget: <b className="text-ink">{usd(rfq.budget, 0)}</b></p> : null}
      {rfq.attachments?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {rfq.attachments.map((a) => (
            <a key={a.url} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-3 py-1.5 text-xs text-forest hover:bg-beige"><Paperclip className="h-3 w-3" />{a.name}</a>
          ))}
        </div>
      )}
    </Card>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <div><p className="text-xs uppercase tracking-wider text-ink-medium">{label}</p><p className="font-medium text-ink">{value}</p></div>
    </div>
  );
}

export function ItemsTable({ items }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-mist px-6 py-4"><h3 className="text-lg text-forest">Requested items</h3></div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Target / unit</th><th className="text-right">CBM / unit</th><th className="text-right">kg / unit</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id}>
                <td><p className="font-medium text-ink">{i.name}</p>{i.specs && <p className="text-xs text-ink-medium">{i.specs}</p>}</td>
                <td className="whitespace-nowrap text-right">{num(i.quantity)} {i.unit}</td>
                <td className="text-right">{i.targetUnitPrice ? usd(i.targetUnitPrice) : '—'}</td>
                <td className="text-right text-ink-medium">{i.cbmPerUnit ? num(i.cbmPerUnit, 4) : '—'}</td>
                <td className="text-right text-ink-medium">{i.weightKgPerUnit ? num(i.weightKgPerUnit, 2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Quote with the latest numbers and the negotiation history. */
export function QuoteView({ quote, items = [], children, viewer }) {
  const subtotal = quote.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return (
    <Card className="overflow-hidden ring-2 ring-gold/30">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-forest to-forest-700 px-6 py-4 text-white">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-light">Quotation</p>
          <p className="font-serif text-2xl">{usd(quote.total)}</p>
        </div>
        <div className="text-right text-xs text-white/75">
          {viewer === 'buyer' && quote.seller && <p className="text-sm text-white">{quote.seller.company || 'Verified seller'}{quote.seller.seller?.country ? ` · ${quote.seller.seller.country}` : ''}</p>}
          <StatusBadge status={quote.status} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {quote.lines.map((l) => {
              const target = items.find((i) => String(i._id) === String(l.itemId))?.targetUnitPrice;
              return (
                <tr key={String(l.itemId)}>
                  <td className="font-medium">{l.name}</td>
                  <td className="whitespace-nowrap text-right">{num(l.quantity)} {l.unit}</td>
                  <td className="text-right">{usd(l.unitPrice)}{target ? <span className={cx('block text-[11px]', l.unitPrice <= target ? 'text-success' : 'text-ink-medium')}>target {usd(target)}</span> : null}</td>
                  <td className="text-right font-medium">{usd(l.unitPrice * l.quantity)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="text-right text-ink-medium">Subtotal</td><td className="text-right">{usd(subtotal)}</td></tr>
            <tr><td colSpan={3} className="text-right text-ink-medium">Shipping / freight</td><td className="text-right">{usd(quote.shippingCost)}</td></tr>
            <tr><td colSpan={3} className="text-right font-medium text-forest">Total (USD)</td><td className="text-right font-serif text-lg text-forest">{usd(quote.total)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="grid gap-3 border-t border-mist px-6 py-4 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-ink-medium">Lead time</p><p className="font-medium">{quote.leadTimeDays ? `${quote.leadTimeDays} days` : '—'}</p></div>
        <div><p className="text-xs text-ink-medium">Incoterm</p><p className="font-medium">{quote.incoterm || '—'}</p></div>
        <div><p className="text-xs text-ink-medium">Valid until</p><p className="font-medium">{date(quote.validUntil)}</p></div>
        <div><p className="text-xs text-ink-medium">Payment</p><p className="font-medium">{quote.paymentTerms || '100% via Ranavista escrow'}</p></div>
      </div>
      {quote.notes && <p className="whitespace-pre-line border-t border-mist px-6 py-4 text-sm text-ink">{quote.notes}</p>}
      {quote.rounds?.length > 1 && (
        <details className="border-t border-mist px-6 py-4">
          <summary className="cursor-pointer text-sm font-medium text-forest">Negotiation history ({quote.rounds.length} rounds)</summary>
          <ol className="mt-3 space-y-2">
            {quote.rounds.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2 text-sm">
                <div><span className="font-medium capitalize">{r.by}</span> {r.by === 'buyer' ? 'countered' : i === 0 ? 'quoted' : 'revised'}{r.message && <p className="text-xs text-ink-medium">“{r.message}”</p>}</div>
                <div className="text-right"><p className="font-medium">{usd(r.total)}</p><p className="text-[11px] text-ink-medium">{dateTime(r.at)}</p></div>
              </li>
            ))}
          </ol>
        </details>
      )}
      {children && <div className="flex flex-wrap gap-2 border-t border-mist bg-cream/40 px-6 py-4">{children}</div>}
    </Card>
  );
}

/** Editable unit prices for counter-offers / revisions. */
export function PriceEditor({ lines, value, onChange }) {
  return (
    <div className="space-y-2">
      {lines.map((l) => (
        <div key={String(l.itemId)} className="grid grid-cols-[1fr_120px] items-center gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{l.name}</p><p className="text-xs text-ink-medium">{num(l.quantity)} {l.unit} · currently {usd(l.unitPrice)}</p></div>
          <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-ink-medium">$</span>
            <input type="number" step="0.01" min="0" className="input pl-7" value={value[l.itemId] ?? ''} onChange={(e) => onChange({ ...value, [l.itemId]: e.target.value })} />
          </div>
        </div>
      ))}
    </div>
  );
}

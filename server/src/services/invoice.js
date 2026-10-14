import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../middleware/upload.js';

const GREEN = '#0D3B32';
const GOLD = '#B89B6B';
const MUTED = '#6B7A78';
const usd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

/** Generates a branded PDF invoice for an order and returns its public path. */
export function generateInvoice(order) {
  return new Promise((resolve, reject) => {
    const file = `invoice-${order.number}.pdf`;
    const full = path.join(UPLOAD_DIR, 'invoices', file);
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const out = fs.createWriteStream(full);
    doc.pipe(out);

    // Header band
    doc.rect(0, 0, doc.page.width, 90).fill(GREEN);
    doc.fillColor('#fff').font('Times-Roman').fontSize(26).text('RANAVISTA', 50, 30, { characterSpacing: 3 });
    doc.fontSize(8).font('Helvetica').fillColor(GOLD).text('SOURCING TODAY FOR A BRIGHTER TOMORROW', 50, 60, { characterSpacing: 1.5 });
    doc.fillColor('#fff').fontSize(20).font('Times-Roman').text('INVOICE', 0, 34, { align: 'right', width: doc.page.width - 50 });

    // Meta
    doc.fillColor('#1F2D2A').font('Helvetica').fontSize(10);
    let y = 115;
    const meta = [
      ['Invoice #', order.number],
      ['Issue date', date(order.paidAt || order.createdAt)],
      ['RFQ', order.rfq?.number || ''],
      ['Payment status', order.paymentStatus.toUpperCase()],
    ];
    meta.forEach(([k, v], i) => {
      doc.fillColor(MUTED).text(k, 380, y + i * 16, { width: 90 });
      doc.fillColor('#1F2D2A').text(v, 470, y + i * 16, { width: 100, align: 'right' });
    });

    const party = (title, u, x) => {
      doc.fillColor(GOLD).fontSize(9).text(title, x, y, { characterSpacing: 1 });
      doc.fillColor('#1F2D2A').fontSize(11).font('Helvetica-Bold').text(u?.company || u?.name || '', x, y + 14);
      doc.font('Helvetica').fontSize(9.5).fillColor('#495057');
      const a = u?.address || {};
      [u?.name, u?.email, a.line1, [a.city, a.state, a.zip].filter(Boolean).join(', '), a.country].filter(Boolean).forEach((line, i) =>
        doc.text(line, x, y + 30 + i * 13)
      );
    };
    party('BILL TO', order.buyer, 50);
    party('SELLER', order.seller, 215);

    // Table
    y = 235;
    doc.rect(50, y, doc.page.width - 100, 22).fill('#E8DDD1');
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9);
    doc.text('ITEM', 58, y + 7).text('QTY', 320, y + 7, { width: 50, align: 'right' }).text('UNIT PRICE', 380, y + 7, { width: 80, align: 'right' }).text('AMOUNT', 470, y + 7, { width: 85, align: 'right' });
    y += 30;
    doc.font('Helvetica').fontSize(10).fillColor('#1F2D2A');
    order.lines.forEach((l) => {
      doc.text(l.name, 58, y, { width: 250 });
      doc.text(`${l.quantity} ${l.unit || ''}`, 300, y, { width: 70, align: 'right' });
      doc.text(usd(l.unitPrice), 380, y, { width: 80, align: 'right' });
      doc.text(usd(l.unitPrice * l.quantity), 470, y, { width: 85, align: 'right' });
      y += 22;
      doc.moveTo(50, y - 6).lineTo(doc.page.width - 50, y - 6).strokeColor('#E0E0E0').stroke();
    });

    y += 8;
    const totals = [
      ['Subtotal', usd(order.subtotal)],
      ['Shipping', usd(order.shippingCost)],
      ['Total (USD)', usd(order.total)],
    ];
    totals.forEach(([k, v], i) => {
      const bold = i === totals.length - 1;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? GREEN : '#495057').fontSize(bold ? 12 : 10);
      doc.text(k, 360, y + i * 20, { width: 100, align: 'right' });
      doc.text(v, 470, y + i * 20, { width: 85, align: 'right' });
    });

    y += 90;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
      'Payment is held securely by Ranavista and released to the seller after delivery is confirmed. ' +
        'Questions about this invoice? Contact support@ranavista.com.',
      50,
      y,
      { width: doc.page.width - 100 }
    );

    doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(GREEN);
    doc.fillColor('#fff').fontSize(8).text('© Ranavista · Building Sustainable Partnerships Worldwide', 50, doc.page.height - 25);

    doc.end();
    out.on('finish', () => resolve(`/uploads/invoices/${file}`));
    out.on('error', reject);
  });
}

export const usd = (n, digits = 2) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });

export const usd0 = (n) => usd(n, 0);
export const num = (n, d = 0) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d });

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
}

export function timeLeft(d) {
  const s = (new Date(d).getTime() - Date.now()) / 1000;
  if (s <= 0) return 'overdue';
  if (s < 3600) return `${Math.ceil(s / 60)} min left`;
  if (s < 86400) return `${Math.floor(s / 3600)}h left`;
  return `${Math.floor(s / 86400)}d left`;
}

// Imperial helpers for US buyers
export const cbmToCuFt = (cbm) => Number(cbm || 0) * 35.3147;
export const kgToLb = (kg) => Number(kg || 0) * 2.20462;

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export const CATEGORIES = [
  'Home Decor', 'Furniture', 'Home Textiles', 'Rugs & Carpets', 'Kitchen & Dining', 'Lighting', 'Bath & Spa', 'Garden & Outdoor',
  'Handicrafts', 'Fashion Accessories', 'Jewelry', 'Apparel', 'Leather Goods', 'Gifts & Seasonal', 'Packaging', 'Other',
];

export const INCOTERMS = ['FOB', 'EXW', 'CIF', 'CFR', 'DDP', 'DAP'];
export const UNITS = ['pcs', 'sets', 'pairs', 'dozen', 'cartons', 'yards', 'meters', 'kg', 'lbs'];

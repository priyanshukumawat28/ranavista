// Mirror of server/src/utils/container.js for instant feedback in the cart.
export const CONTAINERS = {
  '20ft': { label: "20' Standard", cbm: 28, maxKg: 21700 },
  '40ft': { label: "40' Standard", cbm: 58, maxKg: 26500 },
  '40ft_hc': { label: "40' High Cube", cbm: 68, maxKg: 26300 },
};

export function containerFill(items = [], type = '40ft') {
  const c = CONTAINERS[type] || CONTAINERS['40ft'];
  const cbm = items.reduce((s, i) => s + Number(i.cbmPerUnit || 0) * Number(i.quantity || 0), 0);
  const kg = items.reduce((s, i) => s + Number(i.weightKgPerUnit || 0) * Number(i.quantity || 0), 0);
  const volPct = (cbm / c.cbm) * 100;
  const wtPct = (kg / c.maxKg) * 100;
  const fillPct = Math.max(volPct, wtPct);
  const freeCbm = Math.max(0, c.cbm - cbm);
  const freeKg = Math.max(0, c.maxKg - kg);
  const suggestions = items
    .map((i, idx) => {
      const v = Number(i.cbmPerUnit) > 0 ? Math.floor(freeCbm / i.cbmPerUnit) : Infinity;
      const w = Number(i.weightKgPerUnit) > 0 ? Math.floor(freeKg / i.weightKgPerUnit) : Infinity;
      return { idx, name: i.name || `Item ${idx + 1}`, extraUnits: Math.min(v, w) };
    })
    .filter((s) => Number.isFinite(s.extraUnits) && s.extraUnits > 0);
  const recommended = Object.entries(CONTAINERS).find(([, v]) => cbm <= v.cbm && kg <= v.maxKg)?.[0] || 'multiple';
  return { c, cbm, kg, volPct, wtPct, fillPct, limiting: volPct >= wtPct ? 'volume' : 'weight', freeCbm, freeKg, suggestions, recommended, over: fillPct > 100 };
}

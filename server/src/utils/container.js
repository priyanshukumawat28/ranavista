/*
 * Container Fill Optimizer — volume (CBM) + weight based.
 * Usable capacities are practical loading figures (not internal max), so
 * the "fill %" reflects what a forwarder will actually load.
 */
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
  const limiting = volPct >= wtPct ? 'volume' : 'weight';
  const fillPct = Math.max(volPct, wtPct);
  const freeCbm = Math.max(0, c.cbm - cbm);
  const freeKg = Math.max(0, c.maxKg - kg);

  // "Add more to optimize" — how many extra units of each line still fit
  const suggestions = items
    .filter((i) => Number(i.cbmPerUnit) > 0 || Number(i.weightKgPerUnit) > 0)
    .map((i) => {
      const byVol = Number(i.cbmPerUnit) > 0 ? Math.floor(freeCbm / i.cbmPerUnit) : Infinity;
      const byWt = Number(i.weightKgPerUnit) > 0 ? Math.floor(freeKg / i.weightKgPerUnit) : Infinity;
      return { name: i.name, extraUnits: Math.max(0, Math.min(byVol, byWt)) };
    })
    .filter((s) => Number.isFinite(s.extraUnits) && s.extraUnits > 0);

  // Recommend the smallest container that fits
  const recommended =
    Object.entries(CONTAINERS).find(([, v]) => cbm <= v.cbm && kg <= v.maxKg)?.[0] || 'multiple';

  return {
    type,
    container: c,
    totalCbm: +cbm.toFixed(3),
    totalKg: +kg.toFixed(1),
    volumePct: +volPct.toFixed(1),
    weightPct: +wtPct.toFixed(1),
    fillPct: +fillPct.toFixed(1),
    limiting,
    overCapacity: fillPct > 100,
    freeCbm: +freeCbm.toFixed(3),
    freeKg: +freeKg.toFixed(1),
    suggestions,
    recommended,
  };
}

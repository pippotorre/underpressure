// Intervalli di tempo per grafici ed esportazione (settimana da lunedì).
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function startOfWeek(d) { const s = startOfDay(d); const wd = (s.getDay() + 6) % 7; s.setDate(s.getDate() - wd); return s; }

export const PERIODS = [
  { key: 'week', label: 'Questa settimana' },
  { key: 'lastweek', label: 'Settimana scorsa' },
  { key: 'month', label: 'Questo mese' },
  { key: 'lastmonth', label: 'Mese scorso' },
  { key: 'year', label: 'Intero anno' },
  { key: 'all', label: 'Tutto' },
];

/** Restituisce {from, to} (to esclusivo) per il periodo. */
export function range(key, now = new Date()) {
  switch (key) {
    case 'week': { const f = startOfWeek(now); const t = new Date(f); t.setDate(t.getDate() + 7); return { from: f, to: t }; }
    case 'lastweek': { const t = startOfWeek(now); const f = new Date(t); f.setDate(f.getDate() - 7); return { from: f, to: t }; }
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case 'lastmonth': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    default: return { from: new Date(0), to: new Date(8.64e15) };
  }
}

export function inRange(list, key) { const { from, to } = range(key); return list.filter(m => m.ts >= +from && m.ts < +to); }

export function stats(list) {
  if (!list.length) return null;
  const avg = k => Math.round(list.reduce((s, m) => s + m[k], 0) / list.length);
  const by = slot => list.filter(m => m.slot === slot);
  const avgOf = l => l.length ? { sys: Math.round(l.reduce((s, m) => s + m.sys, 0) / l.length), dia: Math.round(l.reduce((s, m) => s + m.dia, 0) / l.length), n: l.length } : null;
  return {
    n: list.length, sys: avg('sys'), dia: avg('dia'), pul: avg('pul'),
    maxSys: Math.max(...list.map(m => m.sys)), minSys: Math.min(...list.map(m => m.sys)),
    maxDia: Math.max(...list.map(m => m.dia)), minDia: Math.min(...list.map(m => m.dia)),
    mattino: avgOf(by('mattino')), sera: avgOf(by('sera')),
  };
}

export const fmtDate = ts => new Date(ts).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = ts => new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = ts => new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

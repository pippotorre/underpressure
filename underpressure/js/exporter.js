// Esportazione (CSV, PDF, backup JSON) e ripristino.
import { classify } from './classify.js';
import { fmtDateTime, stats } from './periods.js';

const CSV_HEAD = ['data_ora', 'profilo', 'nome_profilo', 'sistolica', 'diastolica', 'pulsazioni', 'momento', 'battito_irregolare', 'classe_esh', 'note', 'origine'];
const esc = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const iso = ts => { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/** CSV con separatore ";" (si apre correttamente in Excel italiano). */
export function toCSV(list, names) {
  const rows = list.slice().sort((a, b) => a.ts - b.ts).map(m => [iso(m.ts), m.profile, names[m.profile - 1], m.sys, m.dia, m.pul, m.slot, m.irregular ? 'si' : 'no', classify(m.sys, m.dia).label, m.note, m.source]);
  return '﻿' + [CSV_HEAD, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
}

function parseCSVLine(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}

/** Legge un CSV esportato dall'app (o compatibile) e restituisce le misure. */
export function fromCSV(text) {
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = parseCSVLine(lines[0], sep).map(h => h.trim().toLowerCase());
  const ix = k => head.indexOf(k);
  const req = ['data_ora', 'sistolica', 'diastolica', 'pulsazioni'];
  if (req.some(k => ix(k) < 0)) throw new Error('Il file non ha le colonne attese (data_ora, sistolica, diastolica, pulsazioni).');
  return lines.slice(1).map(l => {
    const c = parseCSVLine(l, sep);
    const [d, t = '00:00'] = c[ix('data_ora')].trim().split(' ');
    const [Y, M, D] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
    const ts = new Date(Y, M - 1, D, h, mi).getTime();
    return {
      ts, profile: Math.min(4, Math.max(1, parseInt(c[ix('profilo')], 10) || 1)),
      sys: +c[ix('sistolica')], dia: +c[ix('diastolica')], pul: +c[ix('pulsazioni')],
      slot: ix('momento') >= 0 ? c[ix('momento')] : '', irregular: ix('battito_irregolare') >= 0 && c[ix('battito_irregolare')] === 'si',
      note: ix('note') >= 0 ? c[ix('note')] : '', source: 'import',
    };
  }).filter(m => m.ts && m.sys && m.dia && m.pul);
}

export function toJSON(list, settings) {
  return JSON.stringify({ app: 'UnderPressure', version: 1, exportedAt: new Date().toISOString(), settings, measurements: list }, null, 1);
}

/** PDF per il medico: intestazione, medie, grafico, tabella. */
export function toPDF(list, { name, periodLabel, health, chartImg }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const st = stats(list);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(38, 53, 58);
  doc.text('Diario della pressione arteriosa', 14, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`${name} · ${periodLabel} · strumento LAICA BM2301`, 14, 25);
  let y = 32;
  if (health && (health.age || health.therapyName)) {
    const bits = [];
    if (health.age) bits.push(`età ${health.age}`);
    if (health.sex) bits.push(health.sex);
    if (health.therapy) bits.push('in terapia' + (health.therapyName ? `: ${health.therapyName}` : ''));
    doc.text(bits.join(' · '), 14, y); y += 6;
  }
  if (st) {
    doc.setFont('helvetica', 'bold'); doc.text(`Media: ${st.sys}/${st.dia} mmHg · polso ${st.pul}/min · ${st.n} misure`, 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const parts = [];
    if (st.mattino) parts.push(`mattino ${st.mattino.sys}/${st.mattino.dia} (${st.mattino.n})`);
    if (st.sera) parts.push(`sera ${st.sera.sys}/${st.sera.dia} (${st.sera.n})`);
    parts.push(`sistolica min-max ${st.minSys}-${st.maxSys}`, `diastolica min-max ${st.minDia}-${st.maxDia}`);
    doc.text(parts.join(' · '), 14, y); y += 6;
  }
  if (chartImg) { doc.addImage(chartImg, 'PNG', 14, y, 182, 70); y += 74; }
  doc.autoTable({
    startY: y,
    head: [['Data e ora', 'Sistolica', 'Diastolica', 'Polso', 'Momento', 'Classe ESH', 'Note']],
    body: list.slice().sort((a, b) => a.ts - b.ts).map(m => [fmtDateTime(m.ts), m.sys, m.dia, m.pul, m.slot, classify(m.sys, m.dia).label, (m.irregular ? '[battito irregolare] ' : '') + (m.note || '')]),
    styles: { fontSize: 8.5, cellPadding: 1.6 }, headStyles: { fillColor: [63, 131, 148] },
    alternateRowStyles: { fillColor: [243, 247, 247] },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(110); doc.text(`Generato con UnderPressure il ${new Date().toLocaleDateString('it-IT')} · pag. ${i}/${pages}`, 14, 290); }
  return doc.output('blob');
}

/** Salva o condivide un file (sul telefono apre il pannello di condivisione). */
export async function deliver(blob, filename, { share = false } = {}) {
  const file = new File([blob], filename, { type: blob.type });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return 'downloaded';
}

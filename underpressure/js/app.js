import { db } from './db.js';
import { recognize } from './ocr.js';
import { classify, alertsFor, personalTarget, slotOf } from './classify.js';
import { PERIODS, range, inRange, stats, fmtDate, fmtTime } from './periods.js';
import { toCSV, fromCSV, toJSON, toPDF, deliver } from './exporter.js';
import { INFO } from './info.js';

const API = './api/';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => $('#view');

const state = {
  profiles: [], active: 1, account: null, list: [], period: 'week', diaryAll: false,
  scan: null, // { img, imgData, result, corners }
};
const DEFAULT_PROFILES = [1, 2, 3, 4].map(n => ({ name: `Profilo ${n}`, health: {} }));
const pname = n => state.profiles[n - 1]?.name || `Profilo ${n}`;

// ---------- avvio ----------
async function init() {
  state.profiles = await db.get('profiles', DEFAULT_PROFILES);
  state.active = await db.get('active', 1);
  state.account = await db.get('account', null);
  state.list = await db.allMeasurements();
  applyTheme(localGet('theme'));
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#profilePill').addEventListener('click', () => go('profili'));
  $('#photoInput').addEventListener('change', onPhoto);
  window.addEventListener('hashchange', render);
  render();
  registerSW();
}

function localGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } }

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#1C2A30' : '#F3F7F7');
  $('#themeToggle').setAttribute('aria-label', dark ? 'Passa al tema chiaro' : 'Passa al tema scuro');
  $('#themeToggle').innerHTML = dark ? ICON.sun : ICON.moon;
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  localSet('theme', next); applyTheme(next);
  if (location.hash === '#grafici') render();
}

function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

function render() {
  const r = (location.hash || '#home').slice(1);
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + r));
  $('#profilePill').textContent = pname(state.active);
  $('#profilePill').dataset.n = state.active;
  const fn = { home: vHome, scan: vScan, salvata: vSaved, manuale: vManual, diario: vDiary, grafici: vCharts, esporta: vExport, profili: vProfiles, info: vInfo }[r] || vHome;
  view().innerHTML = '';
  fn();
  view().focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}

// ---------- icone ----------
const ICON = {
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// ---------- componenti ----------
function measureCard(m, { compact = false } = {}) {
  const c = classify(m.sys, m.dia);
  return `<button class="mcard${compact ? ' compact' : ''}" data-id="${m.id}" style="--cls:${c.color}">
    <span class="mtime">${compact ? fmtTime(m.ts) : fmtDate(m.ts) + ' · ' + fmtTime(m.ts)} · ${esc(m.slot)}</span>
    <span class="mval"><b>${m.sys}</b><span class="sep">/</span><b>${m.dia}</b> <small>mmHg</small></span>
    <span class="mpul">♥ ${m.pul}<small>/min</small></span>
    <span class="chip" style="--cls:${c.color}">${c.label}</span>
    ${m.irregular ? '<span class="flag">battito irregolare</span>' : ''}
    ${m.note ? `<span class="mnote">${esc(m.note)}</span>` : ''}
  </button>`;
}

function profileList() { return state.list.filter(m => m.profile === state.active); }

function alertsHtml(alerts) {
  return alerts.map(a => `<div class="alert ${a.level}">${a.level === 'crit' ? ICON.warn : ''}<p>${esc(a.text)}</p></div>`).join('');
}

// ---------- HOME ----------
function vHome() {
  const mine = profileList();
  const last = mine[0];
  const wk = stats(inRange(mine, 'week'));
  const t = personalTarget(state.profiles[state.active - 1].health);
  view().innerHTML = `
  <section class="hero">
    <p class="eyebrow">Misura per</p>
    <div class="who">${[1, 2, 3, 4].map(n => `<button class="pchip${n === state.active ? ' on' : ''}" data-p="${n}" aria-pressed="${n === state.active}"><i class="pico p${n}"></i>${esc(pname(n))}</button>`).join('')}</div>
    <button class="btn primary big" id="shoot">${ICON.camera}<span>Fotografa il display</span></button>
    <button class="btn ghost" id="manual">${ICON.pen}<span>Inserisci a mano</span></button>
    <p class="hint">Sullo strumento deve comparire l'omino con il numero <b>${state.active}</b>.</p>
  </section>
  <section class="card">
    <h2>Ultima misura</h2>
    ${last ? measureCard(last) : `<p class="empty">Nessuna misura per ${esc(pname(state.active))}. Fai la prima foto al display a misura finita.</p>`}
  </section>
  <section class="card">
    <h2>Questa settimana</h2>
    ${wk ? `<div class="kpis">
      <div><span class="k">${wk.sys}/${wk.dia}</span><span class="l">media mmHg</span></div>
      <div><span class="k">${wk.pul}</span><span class="l">polso medio</span></div>
      <div><span class="k">${wk.n}</span><span class="l">misure</span></div></div>
      <p class="muted">Il tuo obiettivo: sotto ${t.sys}/${t.dia} (${t.source}).</p>` : '<p class="empty">Ancora nessuna misura questa settimana.</p>'}
  </section>
  ${backupReminder()}`;
  $$('.pchip').forEach(b => b.addEventListener('click', async () => { state.active = +b.dataset.p; await db.set('active', state.active); render(); }));
  $('#shoot').addEventListener('click', () => $('#photoInput').click());
  $('#manual').addEventListener('click', () => go('manuale'));
  $$('.mcard').forEach(b => b.addEventListener('click', () => editMeasurement(+b.dataset.id)));
  $('#goBackup')?.addEventListener('click', () => go('esporta'));
}

function backupReminder() {
  if (!state.list.length) return '';
  const lb = +(localGet('lastBackup') || 0);
  const days = (Date.now() - lb) / 864e5;
  if (days < 14) return '';
  return `<section class="card soft"><h2>Backup</h2><p>${lb ? `L'ultimo backup è di ${Math.floor(days)} giorni fa.` : 'Non hai ancora fatto un backup del diario.'} Se perdi il telefono, il backup ti permette di recuperare tutto.</p><button class="btn" id="goBackup">Fai il backup</button></section>`;
}

// ---------- FOTO E RICONOSCIMENTO ----------
async function onPhoto(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  state.scan = { loading: true };
  if (location.hash !== '#scan') location.hash = 'scan'; else render();
  try {
    const img = await loadImage(file);
    const imgData = toImageData(img, 1600);
    await new Promise(r => setTimeout(r, 30));
    const result = recognize(imgData);
    state.scan = { url: URL.createObjectURL(file), imgData, result, corners: result.lcd?.corners || defaultCorners(imgData) };
  } catch (err) {
    console.error(err);
    state.scan = { error: 'Non riesco ad aprire la foto. Riprova.' };
  }
  render();
}

function loadImage(file) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
}
function toImageData(img, maxDim) {
  const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  return x.getImageData(0, 0, c.width, c.height);
}
function defaultCorners(d) {
  const w = d.width, h = d.height;
  return [{ x: w * 0.3, y: h * 0.25 }, { x: w * 0.7, y: h * 0.25 }, { x: w * 0.7, y: h * 0.65 }, { x: w * 0.3, y: h * 0.65 }];
}

const ERRORS = {
  display: 'Non trovo il display nella foto. Inquadra lo strumento dritto, con il display al centro, e riprova. Puoi anche spostare i 4 angoli sul display e premere "Rileggi".',
  contrast: 'Il display è troppo scuro o ha riflessi. Rifai la foto con più luce e senza riflessi.',
  incomplete: 'La misura non era ancora finita: vedo solo la pressione di gonfiaggio. Aspetta il segnale acustico finale, quando compaiono sistolica, diastolica e pulsazioni, poi rifai la foto.',
  unreadable: 'Non riesco a leggere bene tutti i numeri. Rifai la foto più vicino e dritto, oppure sposta gli angoli e premi "Rileggi".',
  ambiguous: 'Alcuni numeri sono incerti. Rifai la foto oppure controlla e correggi i valori a mano.',
  implausible: 'I valori letti non sembrano plausibili. Rifai la foto oppure correggili a mano.',
};

function vScan() {
  const sc = state.scan;
  if (!sc) { go('home'); return; }
  if (sc.loading) { view().innerHTML = '<section class="card center"><div class="spinner"></div><p>Leggo il display…</p></section>'; return; }
  if (sc.error) { view().innerHTML = `<section class="card"><p>${esc(sc.error)}</p><button class="btn primary" id="again">Rifai la foto</button></section>`; $('#again').onclick = () => $('#photoInput').click(); return; }
  const r = sc.result;
  view().innerHTML = `
  <section class="card scanbox">
    <div class="canvaswrap"><canvas id="scanCanvas" aria-label="Foto del display con il riquadro di lettura"></canvas></div>
    <p class="hint">Il riquadro azzurro deve seguire i bordi del display. Se non è così, trascina gli angoli e premi Rileggi.</p>
    <div class="row"><button class="btn" id="reread">Rileggi</button><button class="btn ghost" id="again">Rifai la foto</button></div>
  </section>
  <section id="scanResult"></section>`;
  drawScan();
  setupCornerDrag($('#scanCanvas'));
  $('#again').onclick = () => $('#photoInput').click();
  $('#reread').onclick = () => {
    $('#scanResult').innerHTML = '<div class="card center"><div class="spinner"></div></div>';
    setTimeout(() => { sc.result = recognize(sc.imgData, sc.corners); renderScanResult(); }, 20);
  };
  renderScanResult();
}

function renderScanResult() {
  const sc = state.scan, r = sc.result, box = $('#scanResult');
  if (!r.ok) {
    const partial = r.sys || r.dia || r.pul;
    box.innerHTML = `<div class="card"><div class="alert warn">${ICON.warn}<p>${ERRORS[r.error] || ERRORS.unreadable}</p></div>
      <div class="row"><button class="btn primary" id="again2">Rifai la foto</button>${r.error !== 'incomplete' ? '<button class="btn ghost" id="toManual">Inserisci a mano</button>' : ''}</div></div>`;
    $('#again2').onclick = () => $('#photoInput').click();
    $('#toManual')?.addEventListener('click', () => { state.prefill = { sys: r.sys, dia: r.dia, pul: r.pul, profile: r.profile }; go('manuale'); });
    return;
  }
  const mismatch = r.profile && r.profile !== state.active;
  box.innerHTML = `<form class="card" id="saveForm" novalidate>
    <h2>Valori letti</h2>
    ${valueInputs(r)}
    <div class="profcheck ${mismatch ? 'bad' : r.profile ? 'good' : 'unk'}">
      ${r.profile ? `<span>Profilo sul display: <b>${r.profile}</b> · nell'app: <b>${state.active} (${esc(pname(state.active))})</b></span>`
      : `<label class="check"><input type="checkbox" id="profConfirm"> Non vedo il numero del profilo sul display: confermo che la misura è di <b>${esc(pname(state.active))}</b></label>`}
    </div>
    ${mismatch ? `<div class="alert crit" role="alert">${ICON.warn}<div><p><b>Profili non coerenti.</b> Il display mostra il profilo ${r.profile}, ma nell'app è selezionato il profilo ${state.active} (${esc(pname(state.active))}). La misura non viene salvata.</p>
      <div class="row"><button type="button" class="btn" id="switchProf">Passa a ${esc(pname(r.profile))}</button><button type="button" class="btn ghost" id="again3">Rifai la foto</button></div></div></div>` : ''}
    ${extraInputs({})}
    <button class="btn primary big" id="saveBtn" ${mismatch ? 'disabled' : ''}>Salva nel diario</button>
  </form>`;
  $('#switchProf')?.addEventListener('click', async () => { state.active = r.profile; await db.set('active', state.active); $('#profilePill').textContent = pname(state.active); renderScanResult(); toast(`Profilo attivo: ${pname(state.active)}`); });
  $('#again3')?.addEventListener('click', () => $('#photoInput').click());
  $('#saveForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (mismatch) return;
    if (!r.profile && !$('#profConfirm').checked) { toast('Conferma il profilo prima di salvare', 'warn'); return; }
    await saveFromForm(e.target, r.confidence >= 0.6 && sameValues(e.target, r) ? 'foto' : 'foto (corretta)');
  });
}

const sameValues = (f, r) => +f.sys.value === r.sys && +f.dia.value === r.dia && +f.pul.value === r.pul;

function valueInputs(v) {
  return `<div class="vals">
    <label><span>Sistolica</span><input name="sys" type="number" inputmode="numeric" min="50" max="300" required value="${v.sys ?? ''}"><small>mmHg</small></label>
    <label><span>Diastolica</span><input name="dia" type="number" inputmode="numeric" min="30" max="200" required value="${v.dia ?? ''}"><small>mmHg</small></label>
    <label><span>Pulsazioni</span><input name="pul" type="number" inputmode="numeric" min="30" max="220" required value="${v.pul ?? ''}"><small>/min</small></label>
  </div>`;
}
function extraInputs(m) {
  const slot = m.slot || slotOf(new Date(m.ts || Date.now()));
  return `<div class="extras">
    <fieldset class="seg"><legend>Momento</legend>${['mattino', 'pomeriggio', 'sera'].map(s => `<label><input type="radio" name="slot" value="${s}" ${s === slot ? 'checked' : ''}><span>${s}</span></label>`).join('')}</fieldset>
    <label class="check"><input type="checkbox" name="irregular" ${m.irregular ? 'checked' : ''}> Lo strumento ha segnalato battito irregolare</label>
    <label class="field"><span>Note</span><input name="note" maxlength="200" placeholder="Es. presa la terapia, dopo una camminata" value="${esc(m.note || '')}"></label>
  </div>`;
}

function readForm(f) {
  const v = { sys: +f.sys.value, dia: +f.dia.value, pul: +f.pul.value, slot: f.slot.value, irregular: f.irregular.checked, note: f.note.value.trim() };
  if (!(v.sys >= 50 && v.sys <= 300 && v.dia >= 30 && v.dia <= 200 && v.pul >= 30 && v.pul <= 220)) { toast('Controlla i valori: qualcosa è fuori scala', 'warn'); return null; }
  if (v.dia >= v.sys) { toast('La diastolica deve essere più bassa della sistolica', 'warn'); return null; }
  return v;
}

async function saveFromForm(f, source) {
  const v = readForm(f); if (!v) return;
  const m = { ...v, ts: Date.now(), profile: state.active, source };
  m.id = await db.addMeasurement(m);
  state.list = await db.allMeasurements();
  state.scan = null; state.prefill = null;
  showSaved(m);
}

function showSaved(m) {
  state.saved = m;
  if (location.hash !== '#salvata') location.hash = 'salvata'; else render();
}

function vSaved() {
  const m = state.saved; if (!m) { go('home'); return; }
  const alerts = alertsFor(m, state.profiles[m.profile - 1].health);
  view().innerHTML = `<section class="card"><h2>Salvata nel diario di ${esc(pname(m.profile))}</h2>${measureCard(m)}${alertsHtml(alerts)}
    <div class="row"><button class="btn primary" id="another">${ICON.camera}<span>Altra misura</span></button><button class="btn ghost" id="home">Torna alla home</button></div>
    <p class="muted">Le linee guida consigliano 2 misure a distanza di 1-2 minuti, mattino e sera.</p></section>`;
  $('#another').onclick = () => $('#photoInput').click();
  $('#home').onclick = () => go('home');
}

// disegno della foto con il quadrilatero modificabile
function drawScan() {
  const sc = state.scan, cv = $('#scanCanvas'); if (!cv) return;
  const W = Math.min(cv.parentElement.clientWidth, 520), s = W / sc.imgData.width;
  cv.width = W * devicePixelRatio; cv.height = sc.imgData.height * s * devicePixelRatio;
  cv.style.width = W + 'px'; cv.style.height = sc.imgData.height * s + 'px';
  const x = cv.getContext('2d'); x.setTransform(devicePixelRatio * s, 0, 0, devicePixelRatio * s, 0, 0);
  if (!sc.bitmap) { const t = document.createElement('canvas'); t.width = sc.imgData.width; t.height = sc.imgData.height; t.getContext('2d').putImageData(sc.imgData, 0, 0); sc.bitmap = t; }
  x.drawImage(sc.bitmap, 0, 0);
  const c = sc.corners, accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3F8394';
  x.lineWidth = 3 / s; x.strokeStyle = '#7fd3e6'; x.fillStyle = 'rgba(127,211,230,.12)';
  x.beginPath(); c.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.fill(); x.stroke();
  c.forEach(p => { x.beginPath(); x.arc(p.x, p.y, 14 / s, 0, 7); x.fillStyle = accent; x.fill(); x.lineWidth = 3 / s; x.strokeStyle = '#fff'; x.stroke(); });
  sc.scale = s;
}
function setupCornerDrag(cv) {
  let drag = -1;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / state.scan.scale, y: (e.clientY - r.top) / state.scan.scale }; };
  cv.addEventListener('pointerdown', e => {
    const p = pos(e); let best = -1, bd = 40 / state.scan.scale;
    state.scan.corners.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { drag = best; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  cv.addEventListener('pointermove', e => { if (drag < 0) return; state.scan.corners[drag] = pos(e); drawScan(); });
  cv.addEventListener('pointerup', () => { drag = -1; });
  cv.style.touchAction = 'none';
}

// ---------- INSERIMENTO MANUALE ----------
function vManual() {
  const pre = state.prefill || {};
  view().innerHTML = `<form class="card" id="manForm" novalidate>
    <h2>Nuova misura per ${esc(pname(state.active))}</h2>
    <p class="muted">Data e ora: adesso (${fmtTime(Date.now())}).</p>
    ${valueInputs(pre)}${extraInputs({})}
    <button class="btn primary big">Salva nel diario</button></form>`;
  $('#manForm').addEventListener('submit', e => { e.preventDefault(); saveFromForm(e.target, 'manuale'); });
}

// ---------- DIARIO ----------
function vDiary() {
  const list = state.diaryAll ? state.list : profileList();
  const groups = new Map();
  for (const m of list) { const k = fmtDate(m.ts); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  view().innerHTML = `<section class="card">
    <div class="head"><h2>Diario</h2><label class="switch"><input type="checkbox" id="allP" ${state.diaryAll ? 'checked' : ''}> Tutti i profili</label></div>
    ${list.length ? [...groups].map(([d, ms]) => `<h3 class="day">${d}</h3>${ms.map(m => (state.diaryAll ? `<span class="tag p${m.profile}">${esc(pname(m.profile))}</span>` : '') + measureCard(m, { compact: true })).join('')}`).join('')
      : `<p class="empty">Il diario di ${esc(pname(state.active))} è vuoto.</p>`}
  </section>`;
  $('#allP').onchange = e => { state.diaryAll = e.target.checked; render(); };
  $$('.mcard').forEach(b => b.addEventListener('click', () => editMeasurement(+b.dataset.id)));
}

function editMeasurement(id) {
  const m = state.list.find(x => x.id === id); if (!m) return;
  const dlg = $('#sheet');
  const d = new Date(m.ts), p = n => String(n).padStart(2, '0');
  dlg.innerHTML = `<form method="dialog" id="editForm" novalidate>
    <h2>Modifica misura</h2>
    <label class="field"><span>Data e ora</span><input type="datetime-local" name="when" value="${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}"></label>
    <label class="field"><span>Profilo</span><select name="profile">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === m.profile ? 'selected' : ''}>${n} · ${esc(pname(n))}</option>`).join('')}</select></label>
    ${valueInputs(m)}${extraInputs(m)}
    <p class="muted">Origine: ${esc(m.source || '')}</p>
    <div class="row"><button class="btn primary" value="save">Salva</button><button class="btn ghost" value="cancel" formnovalidate>Annulla</button></div>
    <div class="danger"><button type="button" class="btn link" id="del">Elimina misura</button>
    <div id="delConfirm" hidden><p>Eliminare questa misura? Non si può annullare.</p><button type="button" class="btn dangerbtn" id="delYes">Elimina</button></div></div>
  </form>`;
  dlg.showModal();
  $('#del', dlg).onclick = () => { $('#delConfirm', dlg).hidden = false; };
  $('#delYes', dlg).onclick = async () => { await db.deleteMeasurement(id); state.list = await db.allMeasurements(); dlg.close(); toast('Misura eliminata'); render(); };
  $('#editForm', dlg).addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    const v = readForm(e.target); if (!v) { e.preventDefault(); return; }
    const when = new Date(e.target.when.value).getTime();
    await db.putMeasurement({ ...m, ...v, ts: when || m.ts, profile: +e.target.profile.value });
    state.list = await db.allMeasurements(); toast('Misura aggiornata'); render();
  });
}

// ---------- GRAFICI ----------
let charts = [];
function vCharts() {
  const list = inRange(profileList(), state.period).slice().sort((a, b) => a.ts - b.ts);
  const st = stats(list), t = personalTarget(state.profiles[state.active - 1].health);
  view().innerHTML = `<section class="card">
    <h2>Grafici · ${esc(pname(state.active))}</h2>
    <div class="periods" role="tablist">${PERIODS.map(p => `<button role="tab" class="pchip${p.key === state.period ? ' on' : ''}" data-k="${p.key}" aria-selected="${p.key === state.period}">${p.label}</button>`).join('')}</div>
    ${st ? `<div class="kpis">
      <div><span class="k">${st.sys}/${st.dia}</span><span class="l">media mmHg</span></div>
      <div><span class="k">${st.pul}</span><span class="l">polso medio</span></div>
      <div><span class="k">${st.n}</span><span class="l">misure</span></div>
      ${st.mattino ? `<div><span class="k">${st.mattino.sys}/${st.mattino.dia}</span><span class="l">media mattino</span></div>` : ''}
      ${st.sera ? `<div><span class="k">${st.sera.sys}/${st.sera.dia}</span><span class="l">media sera</span></div>` : ''}
      <div><span class="k">${st.minSys}–${st.maxSys}</span><span class="l">sistolica min–max</span></div>
    </div>
    <div class="chartbox"><canvas id="bpChart" aria-label="Andamento di sistolica e diastolica"></canvas></div>
    <div class="chartbox small"><canvas id="pulChart" aria-label="Andamento delle pulsazioni"></canvas></div>
    <p class="muted">Linea tratteggiata: il tuo obiettivo ${t.sys}/${t.dia}.</p>` : '<p class="empty">Nessuna misura in questo periodo.</p>'}
  </section>`;
  $$('.periods .pchip').forEach(b => b.onclick = () => { state.period = b.dataset.k; render(); });
  if (st) drawCharts(list, t);
}

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function chartOptions(list, unit, yMin, yMax, target) {
  const { from, to } = range(state.period);
  const first = list[0].ts, last = list[list.length - 1].ts;
  const grid = cssVar('--color-line'), txt = cssVar('--color-muted');
  return {
    responsive: true, maintainAspectRatio: false, animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { labels: { color: txt, boxWidth: 12, usePointStyle: true } },
      tooltip: { callbacks: { title: it => new Date(it[0].parsed.x).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), label: it => `${it.dataset.label}: ${it.parsed.y} ${unit}` } },
      targetLines: { lines: target },
    },
    scales: {
      x: { type: 'linear', min: state.period === 'all' ? first - 864e5 / 2 : +from, max: state.period === 'all' ? last + 864e5 / 2 : +to,
        ticks: { color: txt, maxTicksLimit: 7, callback: v => new Date(v).toLocaleDateString('it-IT', state.period === 'year' || state.period === 'all' ? { month: 'short' } : { day: 'numeric', month: 'numeric' }) }, grid: { color: grid } },
      y: { suggestedMin: yMin, suggestedMax: yMax, ticks: { color: txt }, grid: { color: grid } },
    },
  };
}

const targetPlugin = {
  id: 'targetLines',
  afterDatasetsDraw(chart, _a, opts) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    for (const l of opts.lines || []) {
      const py = y.getPixelForValue(l.v); if (py < a.top || py > a.bottom) continue;
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = l.color; ctx.globalAlpha = .7; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); ctx.restore();
    }
  },
};

function drawCharts(list, t) {
  charts.forEach(c => c.destroy()); charts = [];
  if (!window.Chart) return;
  if (!Chart.registry.plugins.get('targetLines')) Chart.register(targetPlugin);
  const pri = cssVar('--color-primary'), acc = cssVar('--color-accent'), muted = cssVar('--color-muted');
  const pts = k => list.map(m => ({ x: m.ts, y: m[k] }));
  const colors = list.map(m => classify(m.sys, m.dia).key).map(k => cssVar('--c-' + { ottimale: 'ok', normale: 'ok2', 'normale-alta': 'warn', grado1: 'high', grado2: 'high2', grado3: 'crit' }[k]));
  charts.push(new Chart($('#bpChart'), {
    type: 'line',
    data: { datasets: [
      { label: 'Sistolica', data: pts('sys'), borderColor: acc, backgroundColor: acc, pointBackgroundColor: colors, pointBorderColor: acc, pointRadius: 4, tension: .25, borderWidth: 2 },
      { label: 'Diastolica', data: pts('dia'), borderColor: pri, backgroundColor: pri, pointBackgroundColor: colors, pointBorderColor: pri, pointRadius: 4, tension: .25, borderWidth: 2 },
    ] },
    options: chartOptions(list, 'mmHg', 60, 160, [{ v: t.sys, color: acc }, { v: t.dia, color: pri }]),
  }));
  charts.push(new Chart($('#pulChart'), {
    type: 'line',
    data: { datasets: [{ label: 'Pulsazioni', data: pts('pul'), borderColor: muted, backgroundColor: muted, pointRadius: 3, tension: .25, borderWidth: 2 }] },
    options: chartOptions(list, '/min', 50, 100, []),
  }));
}

// ---------- ESPORTA / BACKUP ----------
function vExport() {
  const acc = state.account;
  view().innerHTML = `
  <form class="card" id="expForm">
    <h2>Esporta il diario</h2>
    <fieldset class="seg"><legend>Formato</legend>
      <label><input type="radio" name="fmt" value="pdf" checked><span>PDF per il medico</span></label>
      <label><input type="radio" name="fmt" value="csv"><span>CSV (Excel)</span></label>
      <label><input type="radio" name="fmt" value="json"><span>Backup completo</span></label>
    </fieldset>
    <div class="grid2">
      <label class="field"><span>Periodo</span><select name="period">${PERIODS.map(p => `<option value="${p.key}" ${p.key === 'month' ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
      <label class="field"><span>Profilo</span><select name="who"><option value="active">${esc(pname(state.active))}</option><option value="all">Tutti i profili</option></select></label>
    </div>
    <p class="muted" id="fmtHint">Il PDF contiene medie, grafico e tabella delle misure.</p>
    <button class="btn primary big">Esporta</button>
  </form>
  <section class="card">
    <h2>Backup via email</h2>
    ${acc?.token ? `<p>Il backup completo (tutti i profili, CSV e file di ripristino) viene inviato a <b>${esc(acc.email)}</b>. Il server non conserva i dati.</p>
      <button class="btn primary" id="mailBackup">Invia backup ora</button>
      <p class="muted">${localGet('lastBackup') ? 'Ultimo backup: ' + new Date(+localGet('lastBackup')).toLocaleString('it-IT') : 'Nessun backup inviato finora.'}</p>`
    : `<p>Per ricevere il backup via email registrati con il tuo indirizzo.</p><button class="btn" id="goReg">Registrati</button>`}
  </section>
  <section class="card">
    <h2>Ripristina da file</h2>
    <p>Carica un backup (.json) o un CSV esportato dall'app: le misure già presenti non vengono duplicate.</p>
    <label class="btn ghost filebtn">Scegli file<input type="file" id="restoreFile" accept=".json,.csv,text/csv,application/json"></label>
  </section>`;
  const hints = { pdf: 'Il PDF contiene medie, grafico e tabella delle misure.', csv: 'Il CSV si apre con Excel o Numbers e si può ricaricare nell\'app.', json: 'Il backup completo contiene anche nomi dei profili e schede salute: serve per ripristinare l\'app.' };
  $$('input[name=fmt]').forEach(r => r.onchange = () => { $('#fmtHint').textContent = hints[r.value]; });
  $('#expForm').addEventListener('submit', async e => { e.preventDefault(); await doExport(e.target); });
  $('#mailBackup')?.addEventListener('click', mailBackup);
  $('#goReg')?.addEventListener('click', () => go('profili'));
  $('#restoreFile').addEventListener('change', restore);
}

const stamp = () => new Date().toISOString().slice(0, 10);

async function doExport(f) {
  const fmt = f.fmt.value, period = f.period.value, who = f.who.value;
  let list = inRange(state.list, period);
  if (who === 'active') list = list.filter(m => m.profile === state.active);
  const names = state.profiles.map(p => p.name);
  if (fmt === 'json') { await deliver(new Blob([toJSON(state.list, await settingsSnapshot())], { type: 'application/json' }), `underpressure-backup-${stamp()}.json`, { share: true }); return; }
  if (!list.length) { toast('Nessuna misura nel periodo scelto', 'warn'); return; }
  if (fmt === 'csv') { await deliver(new Blob([toCSV(list, names)], { type: 'text/csv;charset=utf-8' }), `underpressure-${stamp()}.csv`, { share: true }); return; }
  const periodLabel = PERIODS.find(p => p.key === period).label.toLowerCase();
  const blobs = [];
  const profilesToDo = who === 'all' ? [1, 2, 3, 4].filter(n => list.some(m => m.profile === n)) : [state.active];
  for (const n of profilesToDo) {
    const sub = list.filter(m => m.profile === n);
    const chartImg = await offscreenChart(sub);
    blobs.push(toPDF(sub, { name: pname(n), periodLabel, health: state.profiles[n - 1].health, chartImg }));
  }
  for (const [i, b] of blobs.entries()) await deliver(b, `pressione-${pname(profilesToDo[i]).replace(/\W+/g, '_')}-${stamp()}.pdf`, { share: blobs.length === 1 });
}

// grafico chiaro per il PDF, disegnato fuori schermo
async function offscreenChart(list) {
  if (!window.Chart || list.length < 2) return null;
  const c = document.createElement('canvas'); c.width = 1200; c.height = 460;
  const s = list.slice().sort((a, b) => a.ts - b.ts), pts = k => s.map(m => ({ x: m.ts, y: m[k] }));
  const ch = new Chart(c, { type: 'line', data: { datasets: [
    { label: 'Sistolica', data: pts('sys'), borderColor: '#D4848F', backgroundColor: '#D4848F', pointRadius: 3, borderWidth: 2 },
    { label: 'Diastolica', data: pts('dia'), borderColor: '#3F8394', backgroundColor: '#3F8394', pointRadius: 3, borderWidth: 2 },
    { label: 'Polso', data: pts('pul'), borderColor: '#9AA7AB', backgroundColor: '#9AA7AB', pointRadius: 2, borderWidth: 1.5, borderDash: [4, 3] },
  ] }, options: { responsive: false, animation: false, devicePixelRatio: 1, plugins: { legend: { labels: { color: '#26353A' } } },
    scales: { x: { type: 'linear', ticks: { color: '#56696E', callback: v => new Date(v).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' }) } }, y: { suggestedMin: 50, suggestedMax: 160, ticks: { color: '#56696E' } } } } });
  const url = c.toDataURL('image/png'); ch.destroy(); return url;
}

async function settingsSnapshot() { return { profiles: state.profiles, active: state.active }; }

async function mailBackup() {
  const btn = $('#mailBackup'); btn.disabled = true; btn.textContent = 'Invio in corso…';
  try {
    const names = state.profiles.map(p => p.name);
    const body = { token: state.account.token, csv: toCSV(state.list, names), json: toJSON(state.list, await settingsSnapshot()) };
    const r = await api('backup.php', body);
    localSet('lastBackup', String(Date.now()));
    toast(r.message || 'Backup inviato: controlla la posta', 'ok');
  } catch (e) { toast(e.message, 'warn'); }
  btn.disabled = false; btn.textContent = 'Invia backup ora';
}

async function restore(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const text = await file.text();
    let items, settings = null;
    if (file.name.endsWith('.json') || text.trim().startsWith('{')) {
      const j = JSON.parse(text);
      if (j.app !== 'UnderPressure') throw new Error('Questo file non è un backup di UnderPressure.');
      items = j.measurements; settings = j.settings;
    } else items = fromCSV(text);
    const key = m => `${m.profile}|${Math.round(m.ts / 60000)}|${m.sys}|${m.dia}|${m.pul}`;
    const have = new Set(state.list.map(key));
    let added = 0;
    for (const m of items) { if (have.has(key(m))) continue; const { id, ...rest } = m; await db.addMeasurement({ ...rest, slot: rest.slot || slotOf(new Date(rest.ts)) }); have.add(key(m)); added++; }
    if (settings?.profiles && state.profiles.every((p, i) => p.name === `Profilo ${i + 1}`)) { state.profiles = settings.profiles; await db.set('profiles', state.profiles); }
    state.list = await db.allMeasurements();
    toast(`Ripristino completato: ${added} misure aggiunte`, 'ok'); render();
  } catch (err) { toast(err.message || 'File non valido', 'warn'); }
}

// ---------- PROFILI, SCHEDA SALUTE, REGISTRAZIONE ----------
function vProfiles() {
  const acc = state.account;
  view().innerHTML = `
  <section class="card"><h2>Profili</h2><p class="muted">Ogni profilo corrisponde a una zona di memoria del BM2301 (omino 1-4). Tocca un profilo per renderlo attivo.</p>
  ${[1, 2, 3, 4].map(n => healthCard(n)).join('')}</section>
  <section class="card" id="account">
    <h2>Registrazione</h2>
    ${acc?.token ? `<p>Registrato come <b>${esc(acc.name)}</b> (${esc(acc.email)}). Il server conosce solo nome ed email.</p><button class="btn link" id="logout">Scollega questo telefono</button>`
    : acc?.pending ? `<form id="verForm" class="stack" novalidate><p>Ti abbiamo inviato un codice a <b>${esc(acc.email)}</b>. Inseriscilo qui.</p>
        <label class="field"><span>Codice</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
        <div class="row"><button class="btn primary">Conferma</button><button type="button" class="btn ghost" id="restartReg">Cambia email</button></div></form>`
    : `<form id="regForm" class="stack" novalidate><p>Con la registrazione puoi ricevere il backup del diario via email. Le misure e le schede salute restano sul telefono.</p>
        <label class="field"><span>Nome</span><input name="name" autocomplete="name" required maxlength="60"></label>
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required maxlength="120"></label>
        <label class="check"><input type="checkbox" name="consent" required> Acconsento all'uso dell'email solo per l'invio dei backup e dei codici di accesso</label>
        <button class="btn primary">Ricevi il codice</button></form>`}
  </section>`;
  $$('.hcard').forEach(card => {
    const n = +card.dataset.n;
    $('.setActive', card).onclick = async () => { state.active = n; await db.set('active', n); render(); };
    $('form', card).addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      const h = { age: +f.age.value || null, sex: f.sex.value, height: +f.height.value || null, weight: +f.weight.value || null, therapy: f.therapy.checked, therapyName: f.therapyName.value.trim(), diabetes: f.diabetes.checked, kidney: f.kidney.checked, heart: f.heart.checked, smoker: f.smoker.checked, targetSys: +f.targetSys.value || null, targetDia: +f.targetDia.value || null };
      state.profiles[n - 1] = { name: f.pname.value.trim() || `Profilo ${n}`, health: h };
      await db.set('profiles', state.profiles); toast('Profilo salvato', 'ok'); render();
    });
  });
  $('#regForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (!f.reportValidity()) return;
    try { await api('register.php', { name: f.name.value.trim(), email: f.email.value.trim() }); state.account = { name: f.name.value.trim(), email: f.email.value.trim(), pending: true }; await db.set('account', state.account); render(); }
    catch (err) { toast(err.message, 'warn'); }
  });
  $('#verForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { const r = await api('verify.php', { email: state.account.email, code: e.target.code.value.trim() }); state.account = { name: state.account.name, email: state.account.email, token: r.token }; await db.set('account', state.account); toast('Email confermata', 'ok'); render(); }
    catch (err) { toast(err.message, 'warn'); }
  });
  $('#restartReg')?.addEventListener('click', async () => { state.account = null; await db.set('account', null); render(); });
  $('#logout')?.addEventListener('click', async () => { state.account = null; await db.set('account', null); render(); });
}

function healthCard(n) {
  const p = state.profiles[n - 1], h = p.health || {}, on = n === state.active;
  const ck = (k, label) => `<label class="check"><input type="checkbox" name="${k}" ${h[k] ? 'checked' : ''}> ${label}</label>`;
  return `<details class="hcard${on ? ' on' : ''}" data-n="${n}">
    <summary><i class="pico p${n}"></i><span class="pn">${esc(p.name)}</span><span class="badge">omino ${n}</span>${on ? '<span class="chip on">attivo</span>' : ''}</summary>
    <form class="stack" novalidate>
      <button type="button" class="btn ghost setActive" ${on ? 'disabled' : ''}>${on ? 'Profilo attivo' : 'Usa questo profilo'}</button>
      <label class="field"><span>Nome del profilo</span><input name="pname" maxlength="30" value="${esc(p.name)}"></label>
      <h3>Scheda salute <small>(facoltativa, resta sul telefono)</small></h3>
      <div class="grid2">
        <label class="field"><span>Età</span><input name="age" type="number" inputmode="numeric" min="18" max="110" value="${h.age ?? ''}"></label>
        <label class="field"><span>Sesso</span><select name="sex"><option value="">—</option><option ${h.sex === 'donna' ? 'selected' : ''}>donna</option><option ${h.sex === 'uomo' ? 'selected' : ''}>uomo</option></select></label>
        <label class="field"><span>Altezza (cm)</span><input name="height" type="number" inputmode="numeric" min="100" max="230" value="${h.height ?? ''}"></label>
        <label class="field"><span>Peso (kg)</span><input name="weight" type="number" inputmode="decimal" min="30" max="250" value="${h.weight ?? ''}"></label>
      </div>
      ${ck('therapy', 'In terapia per la pressione')}
      <label class="field"><span>Farmaci (facoltativo)</span><input name="therapyName" maxlength="120" value="${esc(h.therapyName || '')}"></label>
      ${ck('diabetes', 'Diabete')}${ck('kidney', 'Malattia renale')}${ck('heart', 'Malattia cardiaca o ictus pregresso')}${ck('smoker', 'Fumatore')}
      <div class="grid2">
        <label class="field"><span>Obiettivo sistolica dal medico</span><input name="targetSys" type="number" inputmode="numeric" min="90" max="180" value="${h.targetSys ?? ''}"></label>
        <label class="field"><span>Obiettivo diastolica dal medico</span><input name="targetDia" type="number" inputmode="numeric" min="50" max="110" value="${h.targetDia ?? ''}"></label>
      </div>
      ${h.height && h.weight ? `<p class="muted">Indice di massa corporea: ${(h.weight / (h.height / 100) ** 2).toFixed(1)}</p>` : ''}
      <button class="btn primary">Salva profilo</button>
    </form></details>`;
}

async function api(path, body) {
  let r;
  try { r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error('Serve una connessione a internet per questa operazione.'); }
  let j = {}; try { j = await r.json(); } catch { /* risposta non JSON */ }
  if (!r.ok || j.ok === false) throw new Error(j.error || 'Il server non ha risposto correttamente. Riprova più tardi.');
  return j;
}

// ---------- INFO ----------
function vInfo() {
  view().innerHTML = `<section class="card"><h2>Guida al LAICA BM2301</h2>
    ${INFO.map(s => `<details class="acc" ${s.open ? 'open' : ''}><summary>${esc(s.title)}</summary><div class="acc-body">${s.html}</div></details>`).join('')}
    <p class="muted">Fonte: libretto di istruzioni LAICA BM2301. In caso di dubbio fa fede il libretto originale.</p></section>`;
}

// ---------- SERVICE WORKER E AGGIORNAMENTI ----------
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller; // al primo avvio non c'è nulla da aggiornare
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const show = w => {
      const b = $('#updateBar'); b.hidden = false;
      $('#updateBtn').onclick = () => w.postMessage('skipWaiting');
    };
    if (reg.waiting && hadController) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && hadController) show(w); });
    });
  }).catch(() => { /* offline o non supportato */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

init();

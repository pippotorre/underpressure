// Classificazione della pressione secondo le linee guida ESH 2023 (misure in studio)
// e soglie per l'automisurazione a domicilio (ipertensione se media >= 135/85).

export const CLASSES = [
  { key: 'ottimale', label: 'Ottimale', sys: 120, dia: 80, color: 'var(--c-ok)' },
  { key: 'normale', label: 'Normale', sys: 130, dia: 85, color: 'var(--c-ok2)' },
  { key: 'normale-alta', label: 'Normale-alta', sys: 140, dia: 90, color: 'var(--c-warn)' },
  { key: 'grado1', label: 'Ipertensione grado 1', sys: 160, dia: 100, color: 'var(--c-high)' },
  { key: 'grado2', label: 'Ipertensione grado 2', sys: 180, dia: 110, color: 'var(--c-high2)' },
  { key: 'grado3', label: 'Ipertensione grado 3', sys: Infinity, dia: Infinity, color: 'var(--c-crit)' },
];

/** Classe ESH: vale la peggiore tra sistolica e diastolica. */
export function classify(sys, dia) {
  const i = Math.max(CLASSES.findIndex(c => sys < c.sys), CLASSES.findIndex(c => dia < c.dia));
  return CLASSES[i];
}

/** Obiettivo personale dalla scheda salute (soglie del medico > condizioni > default domiciliare). */
export function personalTarget(health = {}) {
  if (health.targetSys && health.targetDia) return { sys: +health.targetSys, dia: +health.targetDia, source: 'indicato dal medico' };
  if (health.diabetes || health.kidney || health.heart) return { sys: 130, dia: 80, source: 'consigliato con diabete o malattie renali/cardiache' };
  if (health.age >= 80) return { sys: 140, dia: 85, source: 'consigliato oltre gli 80 anni' };
  return { sys: 135, dia: 85, source: 'soglia per le misure fatte a casa' };
}

/** Avvisi su una singola misura. */
export function alertsFor(m, health = {}) {
  const out = [], t = personalTarget(health);
  if (m.sys >= 180 || m.dia >= 110) out.push({ level: 'crit', text: 'Valore molto alto. Riposa 5 minuti e ripeti la misura. Se resta così, o se hai mal di testa forte, dolore al petto, fiato corto o disturbi della vista, chiama il medico o il 112.' });
  else if (m.sys >= t.sys || m.dia >= t.dia) out.push({ level: 'warn', text: `Sopra il tuo obiettivo (${t.sys}/${t.dia}, ${t.source}). Una misura isolata non basta: conta la media di più giorni.` });
  if (m.sys < 90 || m.dia < 50) out.push({ level: 'warn', text: 'Pressione bassa. Se hai capogiri o senso di svenimento, siediti e parlane con il medico.' });
  if (m.pul > 100) out.push({ level: 'info', text: 'Battito sopra 100 al minuto: ripeti la misura dopo qualche minuto di riposo.' });
  else if (m.pul < 50 && !health.therapy) out.push({ level: 'info', text: 'Battito sotto 50 al minuto: se non sei uno sportivo allenato, segnalalo al medico.' });
  if (m.irregular) out.push({ level: 'info', text: 'Lo strumento ha segnalato un battito irregolare: se capita spesso, parlane con il medico.' });
  return out;
}

export function slotOf(date) { const h = date.getHours(); return h < 12 ? 'mattino' : h < 18 ? 'pomeriggio' : 'sera'; }

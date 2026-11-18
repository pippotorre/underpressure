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

export function ageOf(h = {}) {
  if (h.birthYear) return new Date().getFullYear() - +h.birthYear;
  return h.age ? +h.age : null;
}

export function bmiOf(h = {}) { return h.height && h.weight ? +(h.weight / (h.height / 100) ** 2).toFixed(1) : null; }

/** True se la scheda salute ha almeno i dati di base. */
export function healthFilled(h = {}) { return !!(ageOf(h) && h.sex); }

/**
 * Obiettivo personale per le misure fatte a casa (orientativo).
 * Fonte: linee guida ESH 2023. Per l'automisurazione: 135/85 a casa equivale a 140/90 in ambulatorio,
 * 130/80 a casa equivale circa a 130/80 in ambulatorio.
 * Restituisce { sys, dia } = valori da non superare, minSys = sotto questo valore con la terapia
 * parlane con il medico, source = spiegazione breve, reasons = elenco dei motivi.
 */
export function personalTarget(h = {}) {
  const age = ageOf(h), reasons = [];
  const treated = !!h.therapy;
  const risk = ['diabetes', 'kidney', 'coronary', 'stroke', 'heartFailure'].filter(k => h[k]);
  if (h.targetSys && h.targetDia) return { sys: +h.targetSys, dia: +h.targetDia, minSys: null, source: 'indicato dal medico', reasons: ['Obiettivo inserito nella scheda salute: ha la precedenza su tutto.'] };
  if (h.pregnancy) return { sys: 135, dia: 85, minSys: null, source: 'in gravidanza', reasons: ['In gravidanza la soglia di attenzione a casa è 135/85. Segnala subito al medico valori superiori.'] };
  let t;
  if (age && age >= 80 || h.frail) {
    t = { sys: 145, dia: 85, minSys: 125, source: age >= 80 ? 'oltre gli 80 anni' : 'persona fragile' };
    reasons.push('Oltre gli 80 anni, o con fragilità, si punta a una sistolica tra 130 e 145 a casa: valori troppo bassi aumentano il rischio di cadute e capogiri.');
  } else if (age && age >= 65) {
    t = { sys: 135, dia: 80, minSys: 120, source: 'tra 65 e 79 anni' };
    reasons.push('Tra 65 e 79 anni l\'obiettivo è una sistolica tra 120 e 135 e una diastolica sotto 80.');
  } else {
    t = { sys: 130, dia: 80, minSys: treated ? 120 : null, source: age ? 'sotto i 65 anni' : 'valore generale' };
    reasons.push(age ? 'Sotto i 65 anni l\'obiettivo è stare sotto 130/80, idealmente tra 120 e 129 di sistolica.' : 'Inserisci l\'anno di nascita per un obiettivo più preciso: per ora uso 130/80.');
  }
  if (!treated && !risk.length) {
    reasons.push('Senza terapia, la media di più giorni pari o superiore a 135/85 indica ipertensione: in quel caso porta il diario al medico.');
  }
  if (risk.length) reasons.push('Con diabete, malattie renali, cardiache o ictus pregresso è ancora più importante restare nell\'obiettivo: il rischio cardiovascolare è più alto.');
  if (treated) reasons.push(`In terapia: se la sistolica scende sotto ${t.minSys} o hai capogiri alzandoti in piedi, parlane con il medico.`);
  return { ...t, reasons };
}

/** Confronto di una misura (o di una media) con l'obiettivo. */
export function compareToTarget(m, h = {}) {
  const t = personalTarget(h);
  const ds = m.sys - t.sys, dd = m.dia - t.dia;
  if (ds >= 0 || dd >= 0) {
    const parts = [];
    if (ds >= 0) parts.push(`sistolica ${m.sys}`);
    if (dd >= 0) parts.push(`diastolica ${m.dia}`);
    return { status: 'over', label: 'Sopra il tuo obiettivo', detail: `${parts.join(' e ')}, l'obiettivo è stare sotto ${t.sys}/${t.dia}`, t };
  }
  if (t.minSys && m.sys < t.minSys) return { status: 'under', label: 'Sotto il tuo intervallo', detail: `sistolica sotto ${t.minSys}`, t };
  return { status: 'ok', label: 'Nel tuo obiettivo', detail: `sotto ${t.sys}/${t.dia}`, t };
}

/** Consigli dalla scheda salute (non dipendono dalla singola misura). */
export function healthNotes(h = {}) {
  const out = [], bmi = bmiOf(h);
  if (bmi && bmi >= 30) out.push('Indice di massa corporea pari o superiore a 30: perdere peso aiuta ad abbassare la pressione (circa 1 mmHg per ogni kg perso).');
  else if (bmi && bmi >= 25) out.push('Leggero sovrappeso: anche pochi kg in meno aiutano la pressione.');
  if (h.smoker) out.push('Il fumo alza la pressione per circa mezz\'ora: non fumare nei 30 minuti prima della misura.');
  if (h.afib) out.push('Con la fibrillazione atriale i misuratori automatici sono meno precisi: fai 3 misure di fila e considera la media.');
  if (h.cholesterol || h.family) out.push('Colesterolo alto o familiarità aumentano il rischio cardiovascolare: utile condividere il diario con il medico.');
  return out;
}

/** Avvisi su una singola misura. */
export function alertsFor(m, health = {}) {
  const out = [], t = personalTarget(health);
  const c = compareToTarget(m, health);
  if (m.sys >= 180 || m.dia >= 110) out.push({ level: 'crit', text: 'Valore molto alto. Riposa 5 minuti e ripeti la misura. Se resta così, o se hai mal di testa forte, dolore al petto, fiato corto o disturbi della vista, chiama il medico o il 112.' });
  else if (c.status === 'over') out.push({ level: 'warn', text: `Sopra il tuo obiettivo: ${c.detail}, ${t.source}. Una misura isolata non basta: conta la media di più giorni.` });
  else if (c.status === 'under') out.push({ level: 'info', text: `Sistolica sotto ${t.minSys}, il limite basso consigliato con la terapia (${t.source}). Se succede spesso o hai capogiri, parlane con il medico.` });
  if (m.sys < 90 || m.dia < 50) out.push({ level: 'warn', text: 'Pressione bassa. Se hai capogiri o senso di svenimento, siediti e parlane con il medico.' });
  if (m.pul > 100) out.push({ level: 'info', text: 'Battito sopra 100 al minuto: ripeti la misura dopo qualche minuto di riposo.' });
  else if (m.pul < 50 && !health.therapy) out.push({ level: 'info', text: 'Battito sotto 50 al minuto: se non sei uno sportivo allenato, segnalalo al medico.' });
  if (m.irregular && health.afib) out.push({ level: 'info', text: 'Battito irregolare segnalato: con la fibrillazione atriale è atteso. Fai 3 misure e usa la media.' });
  else if (m.irregular) out.push({ level: 'info', text: 'Lo strumento ha segnalato un battito irregolare: se capita spesso, parlane con il medico.' });
  return out;
}

export function slotOf(date) { const h = date.getHours(); return h < 12 ? 'mattino' : h < 18 ? 'pomeriggio' : 'sera'; }

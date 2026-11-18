// Contenuti della pagina Info, tratti dal libretto LAICA BM2301 (HC39/e 05/2016).
export const INFO = [
  { id: 'profilo', title: 'Cambiare profilo (zona di memoria)', open: true, html: `
<p>Il BM2301 chiama i profili <strong>zone di memoria</strong> (1, 2, 3, 4). La misura viene salvata nella zona selezionata per ultima, che compare con l'omino numerato in alto a sinistra sul display.</p>
<ol>
<li>Con lo strumento <strong>spento</strong>, premi <kbd>SET</kbd>: lampeggia l'ultima zona usata.</li>
<li>Scegli la zona con <kbd>+</kbd> o <kbd>−</kbd>.</li>
<li>Conferma con <kbd>SET</kbd>. Lo strumento passa a mese, giorno, ore e minuti: puoi confermarli con <kbd>SET</kbd> senza cambiarli.</li>
<li>Spegni con <kbd>O/I</kbd>. Alla prossima misura il display mostrerà l'omino con il nuovo numero.</li>
</ol>
<p class="tip">Prima di misurare controlla che il numero sull'omino sia quello del profilo scelto nell'app: se non coincidono, l'app blocca il salvataggio.</p>
<p>Posizione dell'omino sul display: <strong>1</strong> in alto a sinistra, <strong>2</strong> in alto a destra, <strong>3</strong> in basso a sinistra, <strong>4</strong> in basso a destra.</p>` },
  { id: 'setup', title: 'Prima configurazione: batterie, data e ora', html: `
<p>Lo strumento funziona con 4 batterie alcaline AA da 1,5 V. Dopo ogni cambio di batterie vanno reimpostati zona, data e ora.</p>
<ol>
<li>Fai scorrere il coperchio del vano batterie nel verso della freccia, inserisci le batterie rispettando la polarità e richiudi.</li>
<li>Con lo strumento spento premi <kbd>SET</kbd>: lampeggia la zona di memoria. Sceglila con <kbd>+</kbd>/<kbd>−</kbd> e conferma con <kbd>SET</kbd>.</li>
<li>Lampeggia il <strong>mese</strong>: regolalo con <kbd>+</kbd>/<kbd>−</kbd> (tenendo premuto scorre più veloce) e conferma con <kbd>SET</kbd>.</li>
<li>Fai lo stesso per <strong>giorno</strong>, <strong>ore</strong> e <strong>minuti</strong>.</li>
<li>Spegni con <kbd>O/I</kbd>.</li>
</ol>
<p>L'ora è sempre in formato 12 ore (AM/PM) e l'unità è sempre mmHg. L'app comunque usa la data e l'ora del telefono.</p>` },
  { id: 'misura', title: 'Come misurare correttamente', html: `
<ul>
<li>Siediti e resta a riposo per <strong>5-10 minuti</strong>. Prima della misura evita cibo, fumo, alcol, caffè, sforzi fisici e bagno.</li>
<li>Usa sempre lo stesso braccio, preferibilmente il <strong>sinistro</strong>, senza maniche arrotolate o gioielli.</li>
<li>Il bordo inferiore del bracciale va <strong>1-2 cm sopra la piega del gomito</strong>, con il palmo rivolto in alto. Deve aderire lasciando lo spazio per un dito.</li>
<li>Braccio appoggiato al tavolo, bracciale <strong>all'altezza del cuore</strong>, piedi a terra. Durante la misura non parlare e non muoverti.</li>
<li>Tieni premuto <kbd>O/I</kbd> fino al segnale acustico: il bracciale si gonfia e si sgonfia da solo. Se serve, si rigonfia fino a 250 mmHg: è normale.</li>
<li>Fai <strong>almeno 2 misure</strong> a distanza di qualche minuto, sempre alle stesse ore (per esempio mattino e sera).</li>
</ul>
<p class="tip">Fotografa il display solo a misura finita, quando compaiono sistolica, diastolica e pulsazioni. Se fotografi durante il gonfiaggio l'app ti avvisa che la misura è incompleta.</p>` },
  { id: 'foto', title: 'Come fare una buona foto', html: `
<ul>
<li>Inquadra lo strumento <strong>dritto davanti</strong>, con il display al centro della foto.</li>
<li>Evita riflessi di lampade o finestre sul display e tieni fermo il telefono.</li>
<li>Il display deve essere intero, con un po' di cornice grigia attorno.</li>
<li>Se la lettura fallisce, puoi spostare i 4 angoli del riquadro sul display e rileggere, oppure rifare la foto.</li>
</ul>` },
  { id: 'memoria', title: 'Memoria e media dello strumento', html: `
<ul>
<li>Ogni zona conserva <strong>30 misure</strong> (in totale 120). Oltre le 30, le più vecchie vengono cancellate.</li>
<li><strong>Rivedere le misure</strong>: tieni premuto <kbd>+</kbd> o <kbd>−</kbd> finché compaiono i dati. Il numero 1 è la misura più recente.</li>
<li><strong>Media (AVG)</strong>: a strumento spento tieni premuto <kbd>−</kbd> fino al segnale: compare la media delle ultime 3 misure.</li>
<li><strong>Cancellare una zona</strong>: seleziona la zona (SET, <kbd>+</kbd>/<kbd>−</kbd>), spegni, poi tieni premuto <kbd>+</kbd> o <kbd>−</kbd> e premi <kbd>SET</kbd> per circa 3 secondi. Il display mostra "---".</li>
</ul>` },
  { id: 'simboli', title: 'Simboli ed errori', html: `
<ul>
<li><strong>Omino con numero</strong>: la zona di memoria (profilo) in uso.</li>
<li><strong>Cuore che vibra</strong>: battito irregolare rilevato. Ripeti la misura; se ricompare, parlane con il medico.</li>
<li><strong>Barra colorata a sinistra</strong>: classificazione OMS della misura (verde normale, giallo ipertensione lieve, arancione moderata, rosso grave).</li>
<li><strong>Batteria</strong>: batterie scariche da sostituire.</li>
<li><strong>Err</strong>: misura non riuscita per movimenti o posizione scorretta. Rileggi "Come misurare" e ripeti. Se il bracciale non si gonfia, cambia le batterie.</li>
</ul>` },
  { id: 'dati', title: 'Dati tecnici', html: `
<ul>
<li>Bracciale per braccio da 22 a 36 cm, uso per adulti.</li>
<li>Pressione da 0 a 300 mmHg (precisione ±3 mmHg), polso da 30 a 180 battiti al minuto (±5%).</li>
<li>Si spegne da solo dopo circa 3 minuti senza uso.</li>
</ul>` },
  { id: 'esh', title: 'Come l\'app classifica le misure', html: `
<p>L'app usa le classi delle linee guida europee ESH 2023. Conta il valore peggiore tra sistolica e diastolica.</p>
<table class="esh"><tr><th>Classe</th><th>Sistolica</th><th>Diastolica</th></tr>
<tr><td><i class="dot ottimale"></i>Ottimale</td><td>&lt; 120</td><td>&lt; 80</td></tr>
<tr><td><i class="dot normale"></i>Normale</td><td>120-129</td><td>80-84</td></tr>
<tr><td><i class="dot normale-alta"></i>Normale-alta</td><td>130-139</td><td>85-89</td></tr>
<tr><td><i class="dot grado1"></i>Ipertensione grado 1</td><td>140-159</td><td>90-99</td></tr>
<tr><td><i class="dot grado2"></i>Ipertensione grado 2</td><td>160-179</td><td>100-109</td></tr>
<tr><td><i class="dot grado3"></i>Ipertensione grado 3</td><td>≥ 180</td><td>≥ 110</td></tr></table>
<p>Per le misure fatte a casa si parla di ipertensione quando la <strong>media</strong> di più giorni è uguale o superiore a <strong>135/85</strong>. Se nella scheda salute inserisci le soglie del medico, l'app usa quelle.</p>
<p class="tip">L'app aiuta a tenere il diario ma non sostituisce il medico.</p>` },
];

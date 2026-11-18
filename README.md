# UnderPressure

PWA per tenere il diario della pressione misurata con il **LAICA BM2301**: si fotografa il display, l'app legge sistolica, diastolica, pulsazioni e profilo (omino 1-4) direttamente sul telefono, senza inviare la foto a nessuno.

- 4 profili rinominabili, ciascuno con una scheda salute facoltativa (resta sul telefono)
- blocco del salvataggio se il profilo sul display non coincide con quello scelto nell'app
- diario, grafici per settimana, mese e anno, classi ESH 2023
- esportazione PDF (per il medico), CSV e backup completo; ripristino da file
- backup via email con registrazione (PHP + MySQL su Tophost)
- funziona offline ed è installabile

## Installazione su Tophost

1. **Database**: da phpMyAdmin apri il database `entratad77228` e importa [`sql/entratad77228.sql`](sql/entratad77228.sql). Crea la tabella `underpressure_users` (tutte le tabelle dell'app hanno il prefisso `underpressure_`, perché il database è condiviso).
2. **Configurazione**: copia `underpressure/api/config.example.php` come `config.php`, compilalo (database, mittente, modalità di invio `mail` o `smtp`) e tienilo da parte.
3. **File**: carica `underpressure.zip` dal file manager di Tophost nella cartella principale del sito ed estrailo. Poi carica il tuo `config.php` in `underpressure/api/`. Il file `.htaccess` di quella cartella ne impedisce la lettura dal web.
4. Apri `https://tuodominio.it/underpressure/` dal telefono e aggiungila alla schermata Home.

Per gli aggiornamenti basta ricaricare lo zip: non contiene `config.php`, quindi la configurazione resta.

Il diario di sviluppo è in [SVILUPPO.md](SVILUPPO.md).

# UnderPressure

PWA per tenere il diario della pressione misurata con il **LAICA BM2301**: si fotografa il display, l'app legge sistolica, diastolica, pulsazioni e profilo (omino 1-4) direttamente sul telefono, senza inviare la foto a nessuno.

- 4 profili rinominabili, ciascuno con una scheda salute facoltativa (resta sul telefono)
- blocco del salvataggio se il profilo sul display non coincide con quello scelto nell'app
- diario, grafici per settimana, mese e anno, classi ESH 2023
- esportazione PDF (per il medico), CSV e backup completo; ripristino da file
- backup via email con registrazione (PHP + MySQL su Tophost)
- funziona offline ed è installabile

## Installazione su Tophost

1. Esegui `./build-zip.sh` (oppure usa lo zip già pronto) e carica `underpressure.zip` dal file manager di Tophost nella cartella principale del sito, poi estrailo.
2. Crea un database MySQL dal pannello Tophost.
3. Apri `https://tuodominio.it/underpressure/setup.php`, inserisci i dati del database e l'indirizzo mittente. La pagina crea la tabella e il file `api/config.php`, poi si disattiva.
4. Apri `https://tuodominio.it/underpressure/` dal telefono e aggiungila alla schermata Home.

Il diario di sviluppo è in [SVILUPPO.md](SVILUPPO.md).

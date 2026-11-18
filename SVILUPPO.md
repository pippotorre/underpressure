# UnderPressure – diario di sviluppo

## Scopo
PWA che legge il display del misuratore di pressione **LAICA BM2301** da una foto e aggiorna un diario con le misure, distinguendo i 4 profili (zone di memoria) dello strumento.

## Scelte fatte
| Tema | Scelta |
|---|---|
| Nome | UnderPressure |
| Hosting | Tophost (PHP + MySQL), caricamento manuale dello zip con la cartella `underpressure/` |
| Stack | HTML/CSS/JS puro con moduli ES, nessuna build. Librerie locali in `vendor/` (Chart.js 4.4.4, jsPDF 2.5.2, jsPDF-AutoTable 3.8.4) per funzionare offline |
| Riconoscimento | Offline sul telefono, motore scritto ad hoc per il display a 7 segmenti (`js/ocr.js`). Se la lettura fallisce si chiede di rifare la foto |
| Dati | Misure, profili e schede salute solo sul telefono (IndexedDB). Sul server solo nome ed email dei registrati |
| Data e ora | Quelle del telefono al momento del salvataggio |
| Database | MySQL `entratad77228` (condiviso): tutte le tabelle con prefisso `underpressure_` |
| Configurazione | `api/config.php` compilato offline dall'utente a partire da `config.example.php`, caricato a mano |
| Backup | Via email tramite PHP `mail()` oppure SMTP autenticato (scelta in `config.php`): il server riceve il file, lo spedisce e non lo conserva. Ripristino da file JSON o CSV |
| Esportazione | A scelta: PDF per il medico, CSV (separatore `;`, si apre in Excel), backup JSON completo |
| Grafica | Palette "acqua e rosa" (primario #3F8394, accento #D4848F, fondo #F3F7F7), tema chiaro/scuro con interruttore, logo cuore + tracciato |
| Classificazione | Linee guida ESH 2023; obiettivo domiciliare 135/85, 130/80 con diabete o malattie renali/cardiache, oppure soglie indicate dal medico |

## Struttura
```
underpressure/            cartella da caricare su Tophost
  index.html, manifest.webmanifest, sw.js
  css/app.css
  js/app.js        interfaccia (hash routing: home, scan, diario, grafici, esporta, profili, info)
  js/ocr.js        riconoscimento del display
  js/db.js         IndexedDB
  js/classify.js   classi ESH, obiettivo personale, avvisi
  js/periods.js    intervalli (settimana, mese, anno) e statistiche
  js/exporter.js   CSV, PDF, JSON, ripristino
  js/info.js       guida tratta dal libretto del BM2301
  api/             register.php, verify.php, backup.php, lib.php, database.sql, config.example.php
sql/entratad77228.sql     tabella da importare con phpMyAdmin
tests/ocr-test.mjs        test del riconoscimento su una cartella di foto
build-zip.sh              crea dist/underpressure.zip
```

## Come funziona il riconoscimento (`js/ocr.js`)
1. **Trova il display**: parte dal centro della foto e allarga la regione dei pixel con luminosità simile allo sfondo dell'LCD; la cornice grigia, più chiara, la ferma. I 4 angoli sono i punti estremi lungo le diagonali. Controlla che il rapporto larghezza/altezza sia circa 0,72; prova più soglie.
2. **Raddrizza** il display in un rettangolo 360×500 con un'omografia.
3. **Binarizza** con una soglia unica tra sfondo e segmenti, poi cancella la cornice scura ai bordi.
4. **Legge i numeri** in tre fasce (SYS, DIA, PUL): trova altezza e bordo destro delle cifre, campiona i 7 segmenti di unità e decine (con l'inclinazione del carattere), le centinaia sono un "1" stretto. Prova 9 combinazioni di passo e inclinazione per ciascuna delle soglie e tiene il valore più votato.
5. **Profilo**: le 4 icone sono in una griglia 2×2 (1 alto-sx, 2 alto-dx, 3 basso-sx, 4 basso-dx). Si guarda la posizione dell'icona accesa rispetto al bordo sinistro e all'altezza della sistolica.
6. **Esiti**: `ok`, `incomplete` (solo SYS visibile, foto fatta durante il gonfiaggio), `unreadable`, `ambiguous`, `implausible`, `display`, `contrast`.

L'utente vede sempre i valori prima di salvare, può correggerli e può spostare i 4 angoli e rileggere.

## Funzionalità
- [x] Foto del display e riconoscimento offline di SYS/DIA/PUL e profilo
- [x] Blocco del salvataggio con avviso se il profilo sul display è diverso da quello dell'app (con pulsante per passare al profilo giusto)
- [x] Conferma manuale del profilo se il numero non si vede
- [x] Correzione manuale dei valori, inserimento manuale senza foto
- [x] 4 profili rinominabili, ciascuno con la sua scheda salute (pagina dedicata)
- [x] Obiettivo personale di pressione calcolato dalla scheda salute e confronto di ogni misura e della media settimanale
- [x] Momento (mattino/pomeriggio/sera), battito irregolare, note
- [x] Diario con modifica ed eliminazione
- [x] Grafici: questa settimana, settimana scorsa, questo mese, mese scorso, intero anno, tutto; medie mattino/sera
- [x] Avvisi: valori molto alti, sopra obiettivo, pressione bassa, polso
- [x] Esportazione PDF/CSV/JSON con scelta del formato, periodo e profilo
- [x] Registrazione con codice via email, backup via email, ripristino da file
- [x] Pagina Info con le procedure del libretto (cambio profilo, data e ora, misura corretta, memoria, simboli)
- [x] PWA installabile e offline, avviso "Nuova versione disponibile"
- [ ] Riconoscimento dell'icona di battito irregolare dal display
- [ ] Promemoria per la misura quotidiana

## Diario
### 2026-11-18
- Analizzate 15 foto del display + 5 aggiuntive (profili 2 e 4, schermata di test con tutti i segmenti). Le 4 icone utente sono in griglia 2×2: il profilo si deduce dalla posizione.
- Scelte con l'utente: riconoscimento offline, dati sul telefono, data/ora del telefono, formato di esportazione a scelta, palette 3 "acqua e rosa", hosting Tophost con backup via email in PHP.
- Motore di riconoscimento: 18 foto su 19 corrette; i profili sono corretti in tutte. L'unica errata è una foto molto inclinata in cui il bordo destro del display viene tagliato: l'app chiede di rifarla o di sistemare gli angoli.
- Problemi risolti: cifre "1" delle centinaia attaccate alle decine (ora lette come cella stretta a parte); residui della cornice scambiati per cifre; ciclo infinito con fascia vuota; ricarica della pagina al primo avvio del service worker; barra "nuova versione" sempre visibile (`[hidden]` sovrascritto dal CSS).
- API PHP provate in locale con MariaDB: registrazione, verifica codice (errato/corretto), backup con 2 allegati, token non valido.
- Su richiesta: tabelle con prefisso `underpressure_` (database condiviso `entratad77228`), file SQL dedicato, `config.example.php` con impostazioni email (`mail()` o SMTP). Tolta la pagina `setup.php`: la configurazione si compila offline e si carica a mano, così non resta una pagina di installazione esposta.
- Aggiunto invio SMTP (SSL 465 o STARTTLS 587) senza librerie esterne; provato in locale con un server SMTP finto senza cifratura.
- Scheda salute resa una pagina dedicata (`#salute`): prima era nascosta dentro la scheda del profilo e l'utente non la trovava. Si apre subito dopo la conferma dell'email e la home la propone finché non è compilata.
- Dati raccolti: anno di nascita (l'età si aggiorna da sola), sesso, altezza e peso (IMC), terapia e farmaci, diabete, malattia renale, malattia coronarica, ictus/TIA, scompenso, fibrillazione atriale, fragilità, gravidanza, fumo, colesterolo, familiarità, obiettivo del medico.
- Obiettivo per le misure a casa (orientativo, ESH 2023): sotto 130/80 sotto i 65 anni; sotto 135/80 tra 65 e 79 (sistolica non sotto 120 con terapia); sotto 145/85 oltre gli 80 o con fragilità (non sotto 125); 135/85 in gravidanza; l'obiettivo del medico ha la precedenza. Ogni misura mostra "Nel tuo obiettivo", "Sopra il tuo obiettivo" o "Sotto il tuo intervallo"; il PDF riporta obiettivo e percentuale di misure sopra.

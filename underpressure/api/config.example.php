<?php
/*
 * Configurazione di UnderPressure.
 * 1. Copia questo file come  config.php  e compilalo.
 * 2. Caricalo su Tophost nella cartella  underpressure/api/  (accanto a questo file).
 *    Il file .htaccess della cartella ne blocca la lettura dal web.
 * config.php NON va nel repository.
 */
return [
    // --- Database MySQL (dati dal pannello Tophost, sezione MySQL) ---
    'db_host' => 'localhost',            // host MySQL indicato da Tophost (spesso "localhost" o "sql.tuodominio.it")
    'db_name' => 'entratad77228',
    'db_user' => 'entratad77228',        // di solito su Tophost coincide con il nome del database
    'db_pass' => 'LA_TUA_PASSWORD_MYSQL',

    // --- Email ---
    'mail_from' => 'noreply@tuodominio.it', // mittente: deve essere una casella o alias del TUO dominio
    'mail_name' => 'UnderPressure',         // nome che compare come mittente

    // Come spedire le email:
    //  'mail' = funzione mail() di PHP (la più semplice, funziona su Tophost senza altri dati)
    //  'smtp' = server SMTP con utente e password (più affidabile contro lo spam)
    'mail_mode' => 'mail',

    // Usati solo con 'mail_mode' => 'smtp' (dati della casella email di Tophost)
    'smtp_host'   => 'smtp.tuodominio.it',  // server SMTP indicato da Tophost per la tua casella
    'smtp_port'   => 465,                   // 465 con 'ssl', 587 con 'tls'
    'smtp_secure' => 'ssl',                 // 'ssl' oppure 'tls'
    'smtp_user'   => 'noreply@tuodominio.it',
    'smtp_pass'   => 'LA_PASSWORD_DELLA_CASELLA',

    // --- Indirizzo pubblico dell'app ---
    'app_url' => 'https://www.tuodominio.it/underpressure/',
];

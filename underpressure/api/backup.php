<?php
// Backup: riceve il diario dal telefono e lo spedisce all'email registrata. Non salva nulla.
require __DIR__ . '/lib.php';
$in = input(8 * 1024 * 1024);
$token = (string)($in['token'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/', $token)) fail('Accesso non valido: registrati di nuovo.', 401);

$pdo = db();
$st = $pdo->prepare('SELECT * FROM up_users WHERE token_hash = ? AND verified = 1');
$st->execute([hash_token($token)]);
$u = $st->fetch();
if (!$u) fail('Accesso non valido: registrati di nuovo.', 401);

// massimo 10 backup al giorno
$today = date('Y-m-d');
$count = ($u['backup_day'] === $today) ? (int)$u['backup_count'] : 0;
if ($count >= 10) fail('Hai già inviato 10 backup oggi. Riprova domani.', 429);

$csv = (string)($in['csv'] ?? '');
$json = (string)($in['json'] ?? '');
if ($json === '' || json_decode($json) === null) fail('Backup non valido.');

$date = date('Y-m-d');
$text = "Ciao {$u['name']},\n\nin allegato trovi il backup del tuo diario UnderPressure del " . date('d/m/Y H:i') . ".\n\n"
      . "- underpressure-backup-$date.json: file completo per il ripristino (Esporta > Ripristina da file).\n"
      . "- underpressure-$date.csv: le misure in formato tabella, apribile con Excel.\n\n"
      . "Conserva questa email: se cambi telefono potrai recuperare tutto.\n";
$ok = send_mail($u['email'], 'Backup diario UnderPressure ' . date('d/m/Y'), $text, [
    ['name' => "underpressure-backup-$date.json", 'type' => 'application/json', 'data' => $json],
    ['name' => "underpressure-$date.csv", 'type' => 'text/csv; charset=UTF-8', 'data' => $csv],
]);
if (!$ok) fail('Non riesco a inviare l\'email. Riprova più tardi.', 500);
$pdo->prepare('UPDATE up_users SET backup_day = ?, backup_count = ?, last_backup_at = NOW() WHERE id = ?')->execute([$today, $count + 1, $u['id']]);
out(['message' => 'Backup inviato a ' . $u['email']]);

<?php
// Registrazione: salva nome ed email e invia un codice di conferma a 6 cifre.
require __DIR__ . '/lib.php';
$in = input();
$email = clean_email($in['email'] ?? '');
$name = mb_substr(trim(strip_tags((string)($in['name'] ?? ''))), 0, 60);
if ($name === '') fail('Inserisci il tuo nome.');

$pdo = db();
$st = $pdo->prepare('SELECT * FROM underpressure_users WHERE email = ?');
$st->execute([$email]);
$u = $st->fetch();

// massimo 5 codici all'ora per indirizzo
$now = time();
if ($u && $u['codes_window'] !== null && $now - (int)$u['codes_window'] < 3600 && (int)$u['codes_sent'] >= 5) {
    fail('Hai richiesto troppi codici. Riprova tra un\'ora.', 429);
}
$code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$codeHash = password_hash($code, PASSWORD_DEFAULT);
$expires = $now + 1800;

if ($u) {
    $window = ($u['codes_window'] !== null && $now - (int)$u['codes_window'] < 3600) ? (int)$u['codes_window'] : $now;
    $sent = $window === (int)$u['codes_window'] ? (int)$u['codes_sent'] + 1 : 1;
    $pdo->prepare('UPDATE underpressure_users SET name = ?, code_hash = ?, code_expires = ?, code_attempts = 0, codes_window = ?, codes_sent = ? WHERE id = ?')
        ->execute([$name, $codeHash, $expires, $window, $sent, $u['id']]);
} else {
    $pdo->prepare('INSERT INTO underpressure_users (name, email, code_hash, code_expires, code_attempts, codes_window, codes_sent, created_at) VALUES (?, ?, ?, ?, 0, ?, 1, NOW())')
        ->execute([$name, $email, $codeHash, $expires, $now]);
}

$text = "Ciao $name,\n\nil tuo codice per UnderPressure è: $code\n\nIl codice vale 30 minuti. Se non hai richiesto tu la registrazione, ignora questa email.\n";
if (!send_mail($email, 'Il tuo codice UnderPressure: ' . $code, $text)) fail('Non riesco a inviare l\'email. Riprova più tardi.', 500);
out(['message' => 'Codice inviato']);

<?php
// Verifica del codice: se corretto, restituisce un token per questo telefono.
require __DIR__ . '/lib.php';
$in = input();
$email = clean_email($in['email'] ?? '');
$code = preg_replace('/\D/', '', (string)($in['code'] ?? ''));

$pdo = db();
$st = $pdo->prepare('SELECT * FROM up_users WHERE email = ?');
$st->execute([$email]);
$u = $st->fetch();
if (!$u || !$u['code_hash']) fail('Richiedi prima un codice.');
if ((int)$u['code_attempts'] >= 5) fail('Troppi tentativi. Richiedi un nuovo codice.', 429);
if (time() > (int)$u['code_expires']) fail('Il codice è scaduto. Richiedine uno nuovo.');
if (!password_verify($code, $u['code_hash'])) {
    $pdo->prepare('UPDATE up_users SET code_attempts = code_attempts + 1 WHERE id = ?')->execute([$u['id']]);
    fail('Codice non corretto.');
}
$token = bin2hex(random_bytes(32));
$pdo->prepare('UPDATE up_users SET verified = 1, code_hash = NULL, code_attempts = 0, token_hash = ? WHERE id = ?')
    ->execute([hash_token($token), $u['id']]);
out(['token' => $token]);

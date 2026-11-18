<?php
// Configurazione iniziale di UnderPressure su Tophost.
// Funziona solo finché api/config.php non esiste: dopo il primo salvataggio si disattiva da sola.
declare(strict_types=1);
$cfgFile = __DIR__ . '/api/config.php';
$done = is_file($cfgFile);
$msg = ''; $ok = false;
$v = ['db_host' => 'localhost', 'db_name' => '', 'db_user' => '', 'mail_from' => '', 'app_url' => ''];
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$v['app_url'] = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/';
$v['mail_from'] = 'noreply@' . preg_replace('/^www\./', '', (string)($_SERVER['HTTP_HOST'] ?? 'tuodominio.it'));

if (!$done && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    foreach (['db_host', 'db_name', 'db_user', 'mail_from', 'app_url'] as $k) $v[$k] = trim((string)($_POST[$k] ?? ''));
    $pass = (string)($_POST['db_pass'] ?? '');
    try {
        if (!filter_var($v['mail_from'], FILTER_VALIDATE_EMAIL)) throw new Exception('L\'indirizzo mittente non è valido.');
        $pdo = new PDO('mysql:host=' . $v['db_host'] . ';dbname=' . $v['db_name'] . ';charset=utf8mb4', $v['db_user'], $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->exec(file_get_contents(__DIR__ . '/api/database.sql'));
        $conf = ['db_host' => $v['db_host'], 'db_name' => $v['db_name'], 'db_user' => $v['db_user'], 'db_pass' => $pass,
                 'mail_from' => $v['mail_from'], 'mail_name' => 'UnderPressure', 'app_url' => $v['app_url']];
        if (file_put_contents($cfgFile, "<?php\n// Creato da setup.php il " . date('Y-m-d H:i') . "\nreturn " . var_export($conf, true) . ";\n") === false)
            throw new Exception('Non riesco a scrivere api/config.php: controlla i permessi della cartella api.');
        @chmod($cfgFile, 0640);
        $ok = true; $done = true;
    } catch (PDOException $e) {
        $msg = 'Connessione al database non riuscita: controlla host, nome, utente e password. (' . htmlspecialchars($e->getMessage()) . ')';
    } catch (Exception $e) {
        $msg = htmlspecialchars($e->getMessage());
    }
}
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES);
?><!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Configura UnderPressure</title>
<style>
body{margin:0;background:#F3F7F7;color:#26353A;font:16px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:560px;margin:0 auto;padding:24px 16px}
.card{background:#FCFEFE;border-radius:16px;box-shadow:0 6px 22px rgba(38,53,58,.08);padding:20px;margin-bottom:16px}
label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:.9rem;color:#56696E;margin-bottom:12px}
input{min-height:44px;border-radius:12px;border:2px solid #DCE6E8;padding:8px 12px;font:inherit;color:#26353A;background:#F3F7F7}
button,.btn{display:inline-block;min-height:48px;padding:12px 20px;border:0;border-radius:14px;background:#3F8394;color:#FCFEFE;font:700 1rem system-ui;text-decoration:none;cursor:pointer}
.err{background:#F6E1E4;padding:12px;border-radius:12px}.ok{background:#E1F0E8;padding:12px;border-radius:12px}
small{color:#56696E}
</style></head><body><main>
<h1>Configura UnderPressure</h1>
<?php if ($ok): ?>
  <div class="card ok"><p><b>Fatto.</b> Il database è pronto e la configurazione è salvata. Questa pagina ora è disattivata.</p></div>
  <a class="btn" href="./">Apri l'app</a>
<?php elseif ($done): ?>
  <div class="card"><p>UnderPressure è già configurata. Per rifare la configurazione elimina il file <code>api/config.php</code> dal file manager di Tophost e ricarica questa pagina.</p></div>
  <a class="btn" href="./">Apri l'app</a>
<?php else: ?>
  <div class="card"><p>PHP <?= $h(PHP_VERSION) ?> <?= version_compare(PHP_VERSION, '7.4', '>=') ? '✓' : '— serve almeno PHP 7.4: aggiornalo dal pannello Tophost' ?></p>
  <p><small>Inserisci i dati del database MySQL che trovi nel pannello Tophost (sezione MySQL). La password viene salvata solo in <code>api/config.php</code> sul tuo spazio.</small></p></div>
  <?php if ($msg): ?><div class="card err"><?= $msg ?></div><?php endif; ?>
  <form class="card" method="post" autocomplete="off">
    <label>Host del database<input name="db_host" required value="<?= $h($v['db_host']) ?>"></label>
    <label>Nome del database<input name="db_name" required value="<?= $h($v['db_name']) ?>"></label>
    <label>Utente del database<input name="db_user" required value="<?= $h($v['db_user']) ?>"></label>
    <label>Password del database<input name="db_pass" type="password" required></label>
    <label>Indirizzo mittente delle email<input name="mail_from" type="email" required value="<?= $h($v['mail_from']) ?>"><small>Deve essere un indirizzo del tuo dominio, altrimenti le email finiscono nello spam.</small></label>
    <label>Indirizzo dell'app<input name="app_url" required value="<?= $h($v['app_url']) ?>"></label>
    <button>Salva e crea il database</button>
  </form>
<?php endif; ?>
</main></body></html>

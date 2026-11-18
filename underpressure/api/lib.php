<?php
// Funzioni comuni alle API di UnderPressure (compatibile PHP 7.4+).
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function cfg(): array {
    static $c = null;
    if ($c === null) {
        $outside = dirname(__DIR__, 2) . '/underpressure-config.php'; // preferibile: fuori dalla cartella pubblica
        $file = is_file($outside) ? $outside : __DIR__ . '/config.php';
        if (!is_file($file)) fail('Configurazione del server mancante.', 500);
        $c = require $file;
    }
    return $c;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = cfg();
        try {
            $pdo = new PDO('mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4', $c['db_user'], $c['db_pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            error_log('UnderPressure DB: ' . $e->getMessage());
            fail('Il database non risponde. Riprova più tardi.', 500);
        }
    }
    return $pdo;
}

function out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data + ['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function input(int $maxBytes = 65536): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Metodo non consentito.', 405);
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) fail('Richiesta troppo grande.', 413);
    $j = json_decode($raw, true);
    if (!is_array($j)) fail('Richiesta non valida.');
    return $j;
}

function clean_email($e): string {
    $e = strtolower(trim((string)$e));
    if (strlen($e) > 120 || !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('Indirizzo email non valido.');
    return $e;
}

function header_safe(string $s): string { return trim(str_replace(["\r", "\n"], ' ', $s)); }

/** Invia una email di testo con eventuali allegati [['name'=>..,'type'=>..,'data'=>..]]. */
function send_mail(string $to, string $subject, string $text, array $attachments = []): bool {
    $c = cfg();
    $from = header_safe($c['mail_from']);
    $fromName = '=?UTF-8?B?' . base64_encode($c['mail_name']) . '?=';
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = "From: $fromName <$from>\r\nReply-To: $from\r\nMIME-Version: 1.0\r\n";
    if (!$attachments) {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
        $body = chunk_split(base64_encode($text));
    } else {
        $b = 'up_' . bin2hex(random_bytes(12));
        $headers .= "Content-Type: multipart/mixed; boundary=\"$b\"\r\n";
        $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text));
        foreach ($attachments as $a) {
            $name = header_safe($a['name']);
            $body .= "--$b\r\nContent-Type: {$a['type']}; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n" . chunk_split(base64_encode($a['data']));
        }
        $body .= "--$b--\r\n";
    }
    if (($c['mail_mode'] ?? 'mail') === 'smtp') return smtp_send($to, $subj, $headers, $body);
    return mail($to, $subj, $body, $headers, '-f' . $from);
}

/** Invio tramite server SMTP autenticato (porta 465 SSL o 587 STARTTLS). */
function smtp_send(string $to, string $subj, string $headers, string $body): bool {
    $c = cfg();
    $host = $c['smtp_host']; $port = (int)($c['smtp_port'] ?? 465); $secure = $c['smtp_secure'] ?? 'ssl';
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 20);
    if (!$fp) { error_log("UnderPressure SMTP: connessione fallita $errstr"); return false; }
    stream_set_timeout($fp, 20);
    $read = function () use ($fp) { $r = ''; while (($l = fgets($fp, 1024)) !== false) { $r .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $r; };
    $cmd = function (string $line, array $ok) use ($fp, $read) {
        if ($line !== '') fwrite($fp, $line . "\r\n");
        $r = $read();
        if (!in_array((int)substr($r, 0, 3), $ok, true)) throw new RuntimeException(trim($r));
        return $r;
    };
    try {
        $cmd('', [220]);
        $me = $_SERVER['SERVER_NAME'] ?? 'localhost';
        $cmd("EHLO $me", [250]);
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('STARTTLS non riuscito');
            $cmd("EHLO $me", [250]);
        }
        if (!empty($c['smtp_user'])) {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($c['smtp_user']), [334]);
            $cmd(base64_encode($c['smtp_pass']), [235]);
        }
        $cmd('MAIL FROM:<' . header_safe($c['mail_from']) . '>', [250]);
        $cmd('RCPT TO:<' . header_safe($to) . '>', [250, 251]);
        $cmd('DATA', [354]);
        $msg = "To: <$to>\r\nSubject: $subj\r\nDate: " . date('r') . "\r\nMessage-ID: <" . bin2hex(random_bytes(8)) . '@' . substr(strrchr($c['mail_from'], '@'), 1) . ">\r\n" . $headers . "\r\n" . $body;
        $msg = preg_replace('/^\./m', '..', str_replace("\r\n", "\n", $msg));
        $cmd(str_replace("\n", "\r\n", $msg) . "\r\n.", [250]);
        $cmd('QUIT', [221]);
        fclose($fp);
        return true;
    } catch (RuntimeException $e) {
        error_log('UnderPressure SMTP: ' . $e->getMessage());
        fclose($fp);
        return false;
    }
}

function hash_token(string $t): string { return hash('sha256', $t); }

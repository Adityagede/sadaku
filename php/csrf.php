<?php
declare(strict_types=1);

require_once __DIR__ . '/environment.php';

function valid_csrf_cookie(string $token, string $key, int $now): bool
{
    if (!preg_match('/^([0-9]{10})\.([a-f0-9]{64})\.([a-f0-9]{64})$/D', $token, $parts)) {
        return false;
    }
    $issued = (int) $parts[1];
    return $issued <= $now && $issued > $now - 86400
        && hash_equals(hash_hmac('sha256', $parts[1] . '.' . $parts[2], $key), $parts[3]);
}

function csrf_token(): string
{
    if (environment('APP_ENV', 'local') !== 'production') {
        ini_set('session.use_strict_mode', '1');
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
        if (!session_start()) {
            throw new DomainException('Sesi belum dapat dimulai. Coba lagi sebentar.', 503);
        }
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        $token = $_SESSION['csrf'];
        session_write_close();
        return $token;
    }

    // Cookie bertanda tangan tidak bergantung pada file sesi suatu instance.
    $key = environment('APP_KEY');
    if (strlen($key) < 32) {
        throw new DomainException('Konfigurasi keamanan server belum lengkap.', 503);
    }
    $now = time();
    $cookie = $_COOKIE['__Host-sadaku_csrf'] ?? '';
    if (is_string($cookie) && valid_csrf_cookie($cookie, $key, $now)) {
        return $cookie;
    }
    $payload = $now . '.' . bin2hex(random_bytes(32));
    $token = $payload . '.' . hash_hmac('sha256', $payload, $key);
    setcookie('__Host-sadaku_csrf', $token, [
        'expires' => $now + 86400, 'path' => '/',
        'secure' => true, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    return $token;
}

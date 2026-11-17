<?php
declare(strict_types=1);

require dirname(__DIR__) . '/php/csrf.php';

$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

$key = bin2hex(random_bytes(32));
$now = time();
$sign = static function (int $issued) use ($key): string {
    $payload = $issued . '.' . bin2hex(random_bytes(32));
    return $payload . '.' . hash_hmac('sha256', $payload, $key);
};
$token = $sign($now);
check(valid_csrf_cookie($token, $key, $now), 'Token baru valid');
check(!valid_csrf_cookie($token, bin2hex(random_bytes(32)), $now), 'Kunci lain ditolak');
check(!valid_csrf_cookie($token . 'a', $key, $now), 'Token yang diubah ditolak');
check(!valid_csrf_cookie($sign($now - 86400), $key, $now), 'Token kedaluwarsa ditolak');
check(!valid_csrf_cookie($sign($now + 1), $key, $now), 'Token dari masa depan ditolak');
check(!valid_csrf_cookie('', $key, $now), 'Token kosong ditolak');
putenv('APP_ENV=production');
putenv('APP_KEY=' . $key);
$_COOKIE['__Host-sadaku_csrf'] = $token;
check(csrf_token() === $token, 'Token tetap valid di konteks permintaan lain');
$_COOKIE['__Host-sadaku_csrf'] = 'invalid';
$fresh = csrf_token();
check($fresh !== $token && valid_csrf_cookie($fresh, $key, time()), 'Cookie rusak diganti');
$_COOKIE['__Host-sadaku_csrf'] = ['invalid'];
check(valid_csrf_cookie(csrf_token(), $key, time()), 'Cookie array tidak menyebabkan error');
putenv('APP_KEY=short');
try {
    csrf_token();
    throw new RuntimeException('Kunci pendek tidak ditolak');
} catch (DomainException $error) {
    check($error->getCode() === 503, 'Konfigurasi produksi tidak lengkap ditolak');
}
echo "Lulus $checks pemeriksaan token CSRF produksi.\n";

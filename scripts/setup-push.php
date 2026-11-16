<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/php/push.php';
if (!is_file($root . '/vendor/autoload.php')) { fwrite(STDERR, "Jalankan composer install terlebih dahulu.\n"); exit(1); }
require $root . '/vendor/autoload.php';
if (environment('VAPID_PUBLIC_KEY') !== '' || environment('VAPID_PRIVATE_KEY') !== '') {
    fwrite(STDERR, "Kunci VAPID sudah tersedia. Kunci tidak diganti agar langganan perangkat tetap berlaku.\n");
    exit(1);
}
$subject = $argv[1] ?? '';
if (!preg_match('~^(?:mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https://[^\s]+)$~D', $subject) || str_contains($subject, '"')) {
    fwrite(STDERR, "Pemakaian: php scripts/setup-push.php https://domain-sadaku-anda\n"); exit(1);
}
try { $keys = Minishlink\WebPush\VAPID::createVapidKeys(); }
catch (Throwable) { fwrite(STDERR, "Kunci belum dapat dibuat. Coba npm run push:setup -- https://domain-sadaku-anda, atau isi OPENSSL_CONF sebelum PHP dijalankan.\n"); exit(1); }
$file = $root . '/.env';
$content = is_file($file) ? file_get_contents($file) : '';
$values = ['VAPID_PUBLIC_KEY' => $keys['publicKey'], 'VAPID_PRIVATE_KEY' => $keys['privateKey'], 'VAPID_SUBJECT' => $subject];
foreach ($values as $key => $value) {
    $line = $key . '="' . $value . '"';
    if (preg_match('/^' . $key . '\s*=/m', $content)) $content = preg_replace('/^' . $key . '\s*=.*$/m', $line, $content);
    else $content = rtrim($content) . "\n" . $line . "\n";
}
if (file_put_contents($file, $content, LOCK_EX) === false) { fwrite(STDERR, "Kunci belum dapat disimpan di .env.\n"); exit(1); }
echo "Kunci VAPID tersimpan di .env lokal tanpa menampilkan kunci privat.\n";

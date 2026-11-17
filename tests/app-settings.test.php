<?php
declare(strict_types=1);
require dirname(__DIR__) . '/php/app-settings.php';

foreach (['', 'javascript:alert(1)', 'http://example.org', '//example.org', 'https://user:secret@example.org', "https://example.org/\nwrong"] as $url) {
    putenv('APP_RATE_URL=' . $url);
    if (public_app_settings()['rateUrl'] !== null) throw new RuntimeException('Tautan tidak aman lolos validasi.');
}
putenv('APP_RATE_URL=https://play.google.com/store/apps/details?id=example.sadaku');
putenv('APP_SUPPORT_URL=https://example.org/support?source=sadaku');
if (public_app_settings() !== ['rateUrl' => 'https://play.google.com/store/apps/details?id=example.sadaku', 'supportUrl' => 'https://example.org/support?source=sadaku']) throw new RuntimeException('Tautan HTTPS valid tidak tersedia.');
putenv('APP_RATE_URL=');
putenv('APP_SUPPORT_URL=');
if (public_app_settings() !== ['rateUrl' => null, 'supportUrl' => null]) throw new RuntimeException('Tautan kosong harus tidak tersedia.');
echo "Konfigurasi tautan Pengaturan: validasi HTTPS dan keadaan kosong lulus.\n";

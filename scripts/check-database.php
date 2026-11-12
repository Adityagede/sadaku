<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/php/database.php';

try {
    if (in_array('--config', $argv, true)) {
        echo 'Host: ' . environment('DB_HOST', '127.0.0.1') . "\n";
        echo 'Port: ' . environment('DB_PORT', '3306') . "\n";
        echo 'Database: ' . environment('DB_DATABASE', 'sadaku') . "\n";
        echo 'Username: ' . environment('DB_USERNAME', 'root') . "\n";
        echo 'Password: ' . (environment('DB_PASSWORD') === '' ? 'kosong' : 'terisi, disembunyikan') . "\n";
        $overrides = array_filter(
            ['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'],
            static fn (string $key): bool => getenv($key) !== false
        );
        if ($overrides) {
            echo 'Nilai dari environment server mengungguli .env: ' . implode(', ', $overrides) . "\n";
        }
        exit;
    }

    $db = database();
    if (in_array('--connection', $argv, true)) {
        echo "Login MySQL dan pemilihan database berhasil.\n";
        exit;
    }
    $db->query('SELECT id FROM albums LIMIT 0');
    $db->query('SELECT id FROM entries LIMIT 0');
    echo "Koneksi MySQL berhasil. Tabel albums dan entries tersedia.\n";
} catch (Throwable $error) {
    $message = $error instanceof PDOException
        ? 'MySQL terhubung, tetapi tabel belum siap. Jalankan php scripts/setup-database.php.'
        : $error->getMessage();
    fwrite(STDERR, $message . "\n");
    exit(1);
}

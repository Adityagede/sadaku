<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/php/database.php';

try {
    $db = database();
    $schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('File skema database tidak dapat dibaca.');
    }
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $schema) as $statement) {
        if (trim($statement) !== '') {
            $db->exec($statement);
        }
    }
    echo "Tabel albums dan entries siap. Tabel yang sudah ada tidak dihapus.\n";
} catch (Throwable $error) {
    $message = $error instanceof PDOException
        ? 'Tabel belum dapat disiapkan. Periksa izin CREATE dan REFERENCES akun database serta kompatibilitas MySQL.'
        : $error->getMessage();
    fwrite(STDERR, $message . "\n");
    exit(1);
}

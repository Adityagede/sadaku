<?php
declare(strict_types=1);
// Only the isolated integration suite may create historical fixtures. The
// public API always stamps new entries with the server's current WIB date.
if (PHP_SAPI !== 'cli' || getenv('SADAKU_ISOLATED_TEST') !== '1' || getenv('DB_DATABASE') !== 'sadaku_test') {
    fwrite(STDERR, "Fixture hanya tersedia di database pengujian sementara.\n");
    exit(1);
}
require dirname(__DIR__) . '/php/database.php';
date_default_timezone_set('Asia/Jakarta');
try {
    $id = $argv[1] ?? '';
    $date = $argv[2] ?? '';
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsed || $parsed->format('Y-m-d') !== $date || $date > date('Y-m-d')) throw new RuntimeException('Tanggal fixture tidak valid.');
    $db = database();
    $reference = require_record($db, 'entries', $id);
    $db->beginTransaction();
    require_record($db, 'albums', $reference['album_id'], true);
    $db->prepare('UPDATE entries SET date=? WHERE id=?')->execute([$date, $id]);
    validate_balance($db, $reference['album_id']);
    $db->commit();
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, "Fixture belum dapat disiapkan.\n");
    exit(1);
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/environment.php';

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $host = environment('DB_HOST', '127.0.0.1');
    $port = environment('DB_PORT', '3306');
    $name = environment('DB_DATABASE', 'sadaku');
    if ($host === '' || preg_match('/[;\x00-\x20]/', $host)
        || !ctype_digit($port) || (int) $port < 1 || (int) $port > 65535
        || !preg_match('/^[a-zA-Z0-9_-]+$/D', $name)) {
        throw new DomainException('Konfigurasi DB_HOST, DB_PORT, atau DB_DATABASE di .env tidak valid.', 503);
    }
    if (!extension_loaded('pdo_mysql')) {
        throw new DomainException('Ekstensi pdo_mysql belum aktif pada PHP yang menjalankan Sadaku.', 503);
    }

    try {
        $connection = new PDO(
            "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
            environment('DB_USERNAME', 'root'),
            environment('DB_PASSWORD'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 5,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
            ]
        );
    } catch (PDOException $error) {
        $code = (int) ($error->errorInfo[1] ?? 0);
        $message = match ($code) {
            1049 => 'Database MySQL belum ditemukan. Buat database sesuai DB_DATABASE di .env, lalu jalankan php scripts/setup-database.php.',
            1045, 1698 => 'Akses MySQL ditolak. Periksa DB_USERNAME dan DB_PASSWORD di .env.',
            default => 'Koneksi MySQL belum berhasil. Pastikan MySQL aktif dan DB_HOST serta DB_PORT di .env sudah sesuai.',
        };
        throw new DomainException($message, 503);
    }

    return $connection;
}

function snapshot(PDO $db): array
{
    $albums = $db->query("SELECT a.id, a.name, a.target, a.deadline, a.motivation, a.color,
        a.image_version AS imageVersion, a.created_at AS createdAt,
        COALESCE(t.balance, 0) AS balance, COALESCE(t.entryCount, 0) AS entryCount
        FROM albums a
        LEFT JOIN (
            SELECT album_id,
                SUM(CASE WHEN type = 'deposit' THEN CAST(amount AS SIGNED) ELSE -CAST(amount AS SIGNED) END) AS balance,
                COUNT(id) AS entryCount
            FROM entries GROUP BY album_id
        ) t ON t.album_id = a.id
        ORDER BY a.created_at DESC, a.id DESC")->fetchAll();

    foreach ($albums as &$album) {
        $album['target'] = (int) $album['target'];
        $album['balance'] = (int) $album['balance'];
        $album['entryCount'] = (int) $album['entryCount'];
    }
    unset($album);

    $entries = $db->query('SELECT id, album_id AS albumId, type, amount, date, note,
        created_at AS createdAt FROM entries ORDER BY date DESC, created_at DESC, id DESC')->fetchAll();
    foreach ($entries as &$entry) {
        $entry['amount'] = (int) $entry['amount'];
    }
    unset($entry);

    return ['albums' => $albums, 'entries' => $entries];
}

function require_record(PDO $db, string $table, string $id, bool $lock = false): array
{
    if (!in_array($table, ['albums', 'entries'], true)) {
        throw new LogicException('Tabel tidak dikenal.');
    }
    $statement = $db->prepare("SELECT * FROM $table WHERE id = ?" . ($lock ? ' FOR UPDATE' : ''));
    $statement->execute([$id]);
    $record = $statement->fetch();
    if (!$record) {
        throw new DomainException('Data sudah tidak ditemukan. Muat ulang halaman dan coba lagi.', 404);
    }
    return $record;
}

function validate_balance(PDO $db, string $albumId): void
{
    $statement = $db->prepare('SELECT type, amount FROM entries WHERE album_id = ? ORDER BY date, created_at, id');
    $statement->execute([$albumId]);
    $balance = 0;
    foreach ($statement as $entry) {
        $balance += $entry['type'] === 'deposit' ? (int) $entry['amount'] : -(int) $entry['amount'];
        if ($balance < 0) {
            throw new DomainException('Perubahan ini membuat saldo negatif pada riwayat album. Periksa tanggal, setoran, dan penarikannya.', 422);
        }
        if ($balance > 9000000000000) {
            throw new DomainException('Saldo album sudah melewati batas pencatatan.', 422);
        }
    }
}

<?php
declare(strict_types=1);

require __DIR__ . '/database.php';
date_default_timezone_set('Asia/Jakarta');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$csrf = $_SESSION['csrf'];
session_write_close();
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function text_input(string $key, int $maximum, bool $required = false): string
{
    if (isset($_POST[$key]) && !is_string($_POST[$key])) {
        throw new DomainException('Format isian tidak valid.', 422);
    }
    $value = trim($_POST[$key] ?? '');
    if (($required && $value === '') || mb_strlen($value) > $maximum) {
        throw new DomainException('Periksa isian ' . $key . '. Isian kosong atau terlalu panjang.', 422);
    }
    return $value;
}

function money_input(string $key): int
{
    $value = text_input($key, 13, true);
    if (!preg_match('/^[0-9]+$/D', $value) || (int) $value < 1 || (int) $value > 1000000000000) {
        throw new DomainException('Nominal harus berupa rupiah bulat, antara Rp1 dan Rp1.000.000.000.000.', 422);
    }
    return (int) $value;
}

function date_input(string $key, bool $required = false): ?string
{
    $value = text_input($key, 10, $required);
    if ($value === '') {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value || $value < '1900-01-01' || $value > '2200-12-31') {
        throw new DomainException('Tanggal harus valid, antara tahun 1900 dan 2200.', 422);
    }
    return $value;
}

try {
    $db = database();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? 'state';
    if (!is_string($action)) {
        throw new DomainException('Permintaan tidak valid.', 400);
    }

    if ($method === 'GET' && $action === 'state') {
        respond(['csrf' => $csrf] + snapshot($db));
    }

    if ($method === 'GET' && $action === 'image') {
        $id = is_string($_GET['id'] ?? null) ? $_GET['id'] : '';
        $statement = $db->prepare('SELECT image, image_type FROM albums WHERE id = ?');
        $statement->execute([$id]);
        $album = $statement->fetch();
        if (!$album || !$album['image']) {
            throw new DomainException('Gambar tidak ditemukan.', 404);
        }
        header('Content-Type: ' . $album['image_type']);
        header('Content-Length: ' . strlen($album['image']));
        echo $album['image'];
        exit;
    }

    if ($method !== 'POST') {
        throw new DomainException('Permintaan tidak tersedia.', 405);
    }
    if (!hash_equals($csrf, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        throw new DomainException('Sesi halaman berubah. Muat ulang halaman lalu coba lagi.', 403);
    }

    if ($action === 'save_album') {
        $id = text_input('id', 32);
        $name = text_input('name', 70, true);
        $target = money_input('target');
        $deadline = date_input('deadline');
        $motivation = text_input('motivation', 180);
        $color = text_input('color', 10, true);
        if (!in_array($color, ['sage', 'peach', 'lilac', 'sand'], true)) {
            throw new DomainException('Warna sampul tidak valid.', 422);
        }

        $image = null;
        $imageType = null;
        $upload = $_FILES['image'] ?? null;
        if ($upload && ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            if (!is_int($upload['error']) || $upload['error'] !== UPLOAD_ERR_OK) {
                throw new DomainException('Gambar gagal diunggah. Pilih ulang gambar maksimal 5 MB.', 422);
            }
            if ($upload['size'] > 5 * 1024 * 1024 || !is_uploaded_file($upload['tmp_name'])) {
                throw new DomainException('Ukuran gambar maksimal 5 MB.', 422);
            }
            $imageType = (new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);
            $dimensions = @getimagesize($upload['tmp_name']);
            if (!in_array($imageType, ['image/jpeg', 'image/png', 'image/webp'], true) || !$dimensions || $dimensions[0] > 12000 || $dimensions[1] > 12000) {
                throw new DomainException('Gunakan JPG, PNG, atau WebP yang valid, maksimal 12.000 piksel per sisi.', 422);
            }
            $image = file_get_contents($upload['tmp_name']);
        }

        $db->beginTransaction();
        $existing = $id !== '' ? require_record($db, 'albums', $id, true) : null;
        $id = $existing ? $id : bin2hex(random_bytes(12));
        $removeImage = text_input('remove_image', 1) === '1';
        $imageVersion = $image !== null ? bin2hex(random_bytes(8)) : ($removeImage ? null : ($existing['image_version'] ?? null));
        $values = [
            $name, $target, $deadline, $motivation, $color,
            $image ?? ($removeImage ? null : ($existing['image'] ?? null)),
            $imageType ?? ($removeImage ? null : ($existing['image_type'] ?? null)),
            $imageVersion,
        ];
        if ($existing) {
            $statement = $db->prepare('UPDATE albums SET name=?, target=?, deadline=?, motivation=?, color=?, image=?, image_type=?, image_version=? WHERE id=?');
            $statement->execute([...$values, $id]);
        } else {
            $statement = $db->prepare('INSERT INTO albums(name,target,deadline,motivation,color,image,image_type,image_version,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
            $statement->execute([...$values, $id, (new DateTimeImmutable())->format('Y-m-d H:i:s.u')]);
        }
        $db->commit();
        respond(['savedId' => $id] + snapshot($db));
    }

    if ($action === 'delete_album') {
        $id = text_input('id', 32, true);
        $db->beginTransaction();
        require_record($db, 'albums', $id, true);
        $db->prepare('DELETE FROM albums WHERE id = ?')->execute([$id]);
        $db->commit();
        respond(snapshot($db));
    }

    if ($action === 'save_entry') {
        $id = text_input('id', 32);
        $albumId = text_input('album_id', 32, true);
        $type = text_input('type', 10, true);
        if (!in_array($type, ['deposit', 'withdrawal'], true)) {
            throw new DomainException('Jenis catatan tidak valid.', 422);
        }
        $amount = money_input('amount');
        $date = date_input('date', true);
        $note = text_input('note', 120);
        if ($date > date('Y-m-d')) {
            throw new DomainException('Tanggal catatan tidak boleh melewati hari ini.', 422);
        }
        $db->beginTransaction();
        // Semua perubahan catatan mengunci album lebih dulu agar validasi saldo konsisten.
        require_record($db, 'albums', $albumId, true);
        if ($id !== '') {
            $existing = require_record($db, 'entries', $id, true);
            if ($existing['album_id'] !== $albumId) {
                throw new DomainException('Album catatan tidak dapat dipindahkan saat mengedit.', 422);
            }
            $db->prepare('UPDATE entries SET type=?, amount=?, date=?, note=? WHERE id=?')->execute([$type, $amount, $date, $note, $id]);
        } else {
            $id = bin2hex(random_bytes(12));
            $db->prepare('INSERT INTO entries(id,album_id,type,amount,date,note,created_at) VALUES(?,?,?,?,?,?,?)')
                ->execute([$id, $albumId, $type, $amount, $date, $note, (new DateTimeImmutable())->format('Y-m-d H:i:s.u')]);
        }
        validate_balance($db, $albumId);
        $db->commit();
        respond(['savedId' => $id] + snapshot($db));
    }

    if ($action === 'delete_entry') {
        $id = text_input('id', 32, true);
        $reference = require_record($db, 'entries', $id);
        $db->beginTransaction();
        require_record($db, 'albums', $reference['album_id'], true);
        $existing = require_record($db, 'entries', $id, true);
        $db->prepare('DELETE FROM entries WHERE id = ?')->execute([$id]);
        validate_balance($db, $existing['album_id']);
        $db->commit();
        respond(snapshot($db));
    }

    throw new DomainException('Permintaan tidak dikenali.', 404);
} catch (DomainException $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
} catch (PDOException $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    $code = (int) ($error->errorInfo[1] ?? 0);
    if ($code === 1146) {
        respond(['error' => 'Tabel Sadaku belum dibuat. Jalankan php scripts/setup-database.php.'], 503);
    }
    if (in_array($code, [1205, 1213], true)) {
        respond(['error' => 'Album sedang diperbarui oleh permintaan lain. Coba simpan lagi.'], 409);
    }
    error_log((string) $error);
    respond(['error' => 'Data belum dapat diproses. Coba lagi sebentar.'], 500);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log((string) $error);
    respond(['error' => 'Data belum dapat diproses. Coba lagi sebentar.'], 500);
}

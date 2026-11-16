<?php
declare(strict_types=1);

require __DIR__ . '/database.php';
require __DIR__ . '/csrf.php';
require __DIR__ . '/push.php';
require __DIR__ . '/app-settings.php';
date_default_timezone_set('Asia/Jakarta');
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

function plan_input(string $prefix = ''): array
{
    $frequency = text_input($prefix . 'frequency', 10, true);
    if (!in_array($frequency, ['daily', 'weekly', 'monthly'], true)) throw new DomainException('Pilih jadwal harian, mingguan, atau bulanan.', 422);
    $amount = money_input($prefix . 'amount');
    $start = date_input($prefix . 'start_date', true);
    $day = text_input($prefix . 'schedule_day', 2, true);
    if (!ctype_digit($day) || ($frequency === 'weekly' && (int) $day > 6) || ($frequency === 'monthly' && ((int) $day < 1 || (int) $day > 31))) throw new DomainException('Hari atau tanggal jadwal tidak valid.', 422);
    $time = text_input($prefix . 'reminder_time', 5, true);
    if (!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $time)) throw new DomainException('Jam pengingat harus valid.', 422);
    $reminder = text_input($prefix . 'reminder_enabled', 1);
    $paused = text_input($prefix . 'paused', 1);
    if (!in_array($reminder, ['', '0', '1'], true) || !in_array($paused, ['', '0', '1'], true)) throw new DomainException('Pengaturan rencana tidak valid.', 422);
    return [$frequency, $amount, $start, $frequency === 'daily' ? 1 : (int) $day, $reminder === '1' ? 1 : 0, $time, $paused === '1' ? 1 : 0];
}

function save_album_plan(PDO $db, string $id, ?array $plan): void
{
    if ($plan === null) {
        $db->prepare('DELETE FROM saving_plans WHERE album_id=?')->execute([$id]);
        return;
    }
    $db->prepare('INSERT INTO saving_plans(album_id,frequency,amount,start_date,schedule_day,reminder_enabled,reminder_time,paused) VALUES(?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE frequency=VALUES(frequency),amount=VALUES(amount),start_date=VALUES(start_date),schedule_day=VALUES(schedule_day),reminder_enabled=VALUES(reminder_enabled),reminder_time=VALUES(reminder_time),paused=VALUES(paused)')
        ->execute([$id, ...$plan]);
}

try {
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 4352 * 1024) {
        throw new DomainException('Ukuran unggahan terlalu besar. Pilih gambar maksimal 4 MB.', 413);
    }
    $csrf = csrf_token();
    $db = database();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? 'state';
    if (!is_string($action)) {
        throw new DomainException('Permintaan tidak valid.', 400);
    }

    if ($method === 'GET' && $action === 'state') {
        respond(['csrf' => $csrf, 'push' => push_status(), 'settings' => public_app_settings()] + snapshot($db));
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

    if ($action === 'save_plan') {
        $id = text_input('album_id', 32, true);
        $plan = plan_input();
        $db->beginTransaction();
        require_record($db, 'albums', $id, true);
        save_album_plan($db, $id, $plan);
        $db->commit();
        respond(snapshot($db));
    }

    if ($action === 'subscribe_push') {
        if (!push_status()['configured']) throw new DomainException('Layanan pengingat belum dikonfigurasi di server. Rencana tetap dapat digunakan.', 503);
        $subscription = validate_subscription(text_input('subscription', 4096, true));
        $db->prepare('INSERT INTO push_subscriptions(id,endpoint_hash,subscription,created_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE subscription=VALUES(subscription)')
            ->execute([bin2hex(random_bytes(16)), hash('sha256', $subscription['endpoint']), json_encode($subscription, JSON_THROW_ON_ERROR)]);
        respond(['ok' => true]);
    }

    if ($action === 'unsubscribe_push' || $action === 'test_push' || $action === 'push_device') {
        $endpoint = text_input('endpoint', 2048, true);
        $hash = hash('sha256', $endpoint);
        if ($action === 'unsubscribe_push') {
            $db->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([$hash]);
            respond(['ok' => true]);
        }
        $statement = $db->prepare('SELECT subscription FROM push_subscriptions WHERE endpoint_hash=?');
        $statement->execute([$hash]);
        $stored = $statement->fetchColumn();
        if ($action === 'push_device') respond(['registered' => (bool) $stored]);
        if (!$stored) throw new DomainException('Aktifkan notifikasi perangkat ini terlebih dahulu.', 422);
        $report = send_push(json_decode($stored, true, 8, JSON_THROW_ON_ERROR), ['title' => 'Pengingat Sadaku siap', 'body' => 'Notifikasi perangkat ini sudah terhubung. Jadwal mengikuti rencana menabungmu.', 'url' => './', 'tag' => 'sadaku-test']);
        if (!$report->isSuccess()) {
            if ($report->isSubscriptionExpired()) $db->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([$hash]);
            throw new DomainException('Notifikasi uji belum terkirim. Coba aktifkan ulang notifikasi perangkat.', 502);
        }
        respond(['ok' => true]);
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
        $updatePlan = array_key_exists('plan_enabled', $_POST);
        $plan = null;
        if ($updatePlan) {
            $enabled = text_input('plan_enabled', 1, true);
            if (!in_array($enabled, ['0', '1'], true)) throw new DomainException('Pengaturan rencana tidak valid.', 422);
            if ($enabled === '1') $plan = plan_input('plan_');
        }

        $image = null;
        $imageType = null;
        $upload = $_FILES['image'] ?? null;
        if ($upload && ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            if (!is_int($upload['error']) || $upload['error'] !== UPLOAD_ERR_OK) {
                throw new DomainException('Gambar gagal diunggah. Pilih ulang gambar maksimal 4 MB.', 422);
            }
            if ($upload['size'] > 4 * 1024 * 1024 || !is_uploaded_file($upload['tmp_name'])) {
                throw new DomainException('Ukuran gambar maksimal 4 MB.', 422);
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
        if ($updatePlan) save_album_plan($db, $id, $plan);
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
        $note = text_input('note', 120);
        $db->beginTransaction();
        // Semua perubahan catatan mengunci album lebih dulu agar validasi saldo konsisten.
        require_record($db, 'albums', $albumId, true);
        if ($id !== '') {
            $existing = require_record($db, 'entries', $id, true);
            if ($existing['album_id'] !== $albumId) {
                throw new DomainException('Album catatan tidak dapat dipindahkan saat mengedit.', 422);
            }
            // Editing an old record preserves its date, including pre-existing backdated records.
            $db->prepare('UPDATE entries SET type=?, amount=?, note=? WHERE id=?')->execute([$type, $amount, $note, $id]);
        } else {
            // The server stamps the date at save time, including a form left open past midnight.
            $recordedAt = new DateTimeImmutable('now', new DateTimeZone('Asia/Jakarta'));
            $date = $recordedAt->format('Y-m-d');
            $id = bin2hex(random_bytes(12));
            $db->prepare('INSERT INTO entries(id,album_id,type,amount,date,note,created_at) VALUES(?,?,?,?,?,?,?)')
                ->execute([$id, $albumId, $type, $amount, $date, $note, $recordedAt->format('Y-m-d H:i:s.u')]);
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

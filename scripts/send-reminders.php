<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/php/database.php';
require dirname(__DIR__) . '/php/saving-plan.php';
require dirname(__DIR__) . '/php/push.php';
date_default_timezone_set('Asia/Jakarta');

function dispatch_reminders(PDO $db, ?DateTimeImmutable $now = null, ?callable $sender = null): int
{
    if (!$db->query("SELECT GET_LOCK('sadaku_reminders', 0)")->fetchColumn()) return 0;
    $sent = 0;
    try {
        $now = ($now ?? new DateTimeImmutable())->setTimezone(new DateTimeZone('Asia/Jakarta'));
        $sender ??= 'send_push';
        $state = snapshot($db);
        $subscriptions = $db->query('SELECT id FROM push_subscriptions')->fetchAll();
        foreach ($state['albums'] as $album) {
            if (!reminder_due($album, $state['entries'], $now)) continue;
            // Entry writes and plan edits lock this same album. Recheck after taking
            // the lock so a just-saved deposit/pause cannot race the reminder.
            $db->beginTransaction();
            require_record($db, 'albums', $album['id'], true);
            $fresh = snapshot($db);
            $album = array_values(array_filter($fresh['albums'], static fn ($item) => $item['id'] === $album['id']))[0];
            if (!reminder_due($album, $fresh['entries'], $now)) { $db->commit(); continue; }
            $date = $now->format('Y-m-d');
            foreach ($subscriptions as $subscription) {
                $current = $db->prepare('SELECT subscription FROM push_subscriptions WHERE id=? FOR UPDATE');
                $current->execute([$subscription['id']]);
                $stored = $current->fetchColumn();
                if (!$stored) continue;
                $already = $db->prepare('SELECT 1 FROM reminder_deliveries WHERE album_id=? AND subscription_id=? AND due_date=?');
                $already->execute([$album['id'], $subscription['id'], $date]);
                if ($already->fetchColumn()) continue;
                $remaining = min($album['target'] - $album['balance'], max(0, $album['plan']['amount'] - plan_deposits($album['plan'], $fresh['entries'], $album['id'], $date)));
                $report = $sender(json_decode($stored, true, 8, JSON_THROW_ON_ERROR), [
                    'title' => 'Waktunya menabung', 'body' => $album['name'] . ': sisihkan Rp' . number_format($remaining, 0, ',', '.') . ' untuk jadwal hari ini.',
                    'url' => './#album/' . $album['id'], 'tag' => 'sadaku-' . $album['id'] . '-' . $date,
                ]);
                if ($report->isSuccess()) {
                    $db->prepare('INSERT IGNORE INTO reminder_deliveries(album_id,subscription_id,due_date,sent_at) VALUES(?,?,?,NOW())')->execute([$album['id'], $subscription['id'], $date]);
                    $sent++;
                } elseif ($report->isSubscriptionExpired()) {
                    $db->prepare('DELETE FROM push_subscriptions WHERE id=?')->execute([$subscription['id']]);
                } else {
                    fwrite(STDERR, "Satu pengingat belum terkirim; akan dicoba pada putaran berikutnya.\n");
                }
            }
            $db->commit();
        }
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    } finally { $db->query("SELECT RELEASE_LOCK('sadaku_reminders')"); }
    return $sent;
}

if (realpath($_SERVER['SCRIPT_FILENAME']) !== __FILE__) return;
$watch = in_array('--watch', $argv, true);
do {
    try {
        if (!push_status()['configured']) throw new RuntimeException('Lengkapi konfigurasi VAPID dan composer install sebelum menjalankan pengingat.');
        echo date('c') . ' ' . dispatch_reminders(database()) . " pengingat terkirim.\n";
    } catch (Throwable $error) {
        fwrite(STDERR, "Pengingat belum dapat diproses: " . ($error instanceof DomainException || $error instanceof RuntimeException && !$error instanceof PDOException ? $error->getMessage() : 'Periksa koneksi dan layanan push.') . "\n");
        if (!$watch) exit(1);
    }
    if ($watch) sleep(60);
} while ($watch);

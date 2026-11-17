<?php
declare(strict_types=1);
if (getenv('SADAKU_ISOLATED_TEST') !== '1') { fwrite(STDERR, "Jalankan melalui npm test agar database pribadi tidak berubah.\n"); exit(1); }
require dirname(__DIR__) . '/scripts/send-reminders.php';
$db = database();
$album = str_repeat('c', 24);
$subscriptionId = str_repeat('d', 32);
$date = '2026-11-13';
$now = new DateTimeImmutable($date . 'T19:00:00+07:00');
$calls = 0;
$success = true;
$expired = false;
$transport = static function (array $subscription, array $payload) use (&$calls, &$success, &$expired): object {
    $calls++;
    if ($payload['url'] !== './#album/' . str_repeat('c', 24)) throw new RuntimeException('Tautan album salah.');
    return new class($success, $expired) {
        public function __construct(private bool $success, private bool $expired) {}
        public function isSuccess(): bool { return $this->success; }
        public function isSubscriptionExpired(): bool { return $this->expired; }
    };
};
function verify(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
try {
    $db->prepare('INSERT INTO albums(id,name,target,color,created_at) VALUES(?,?,?, ?,NOW())')->execute([$album, 'Album pengujian pengingat', 1000000, 'sage']);
    $db->prepare('INSERT INTO saving_plans(album_id,frequency,amount,start_date,schedule_day,reminder_enabled,reminder_time) VALUES(?,?,?,?,?,?,?)')->execute([$album, 'weekly', 100000, $date, 5, 1, '19:00']);
    $db->prepare('INSERT INTO push_subscriptions(id,endpoint_hash,subscription,created_at) VALUES(?,?,?,NOW())')->execute([$subscriptionId, hash('sha256', 'test'), '{}']);
    verify(dispatch_reminders($db, $now->modify('-1 minute'), $transport) === 0 && $calls === 0, 'Tidak mengirim sebelum jam.');
    verify(dispatch_reminders($db, $now, $transport) === 1 && $calls === 1, 'Mengirim saat jatuh tempo.');
    verify(dispatch_reminders($db, $now, $transport) === 0 && $calls === 1, 'Tidak mengirim duplikat.');
    $db->exec('DELETE FROM reminder_deliveries');
    $db->prepare('UPDATE saving_plans SET paused=1 WHERE album_id=?')->execute([$album]);
    verify(dispatch_reminders($db, $now, $transport) === 0, 'Jeda menghentikan pengiriman.');
    $db->prepare('UPDATE saving_plans SET paused=0 WHERE album_id=?')->execute([$album]);
    $db->prepare('INSERT INTO entries(id,album_id,type,amount,date,created_at) VALUES(?,?,?,?,?,NOW())')->execute([str_repeat('e', 24), $album, 'deposit', 100000, $date]);
    verify(dispatch_reminders($db, $now, $transport) === 0, 'Setoran memenuhi jadwal menghentikan pengingat.');
    $db->prepare('UPDATE entries SET amount=50000 WHERE album_id=?')->execute([$album]);
    $success = false;
    verify(dispatch_reminders($db, $now, $transport) === 0, 'Pengiriman gagal tidak dianggap terkirim.');
    $success = true;
    verify(dispatch_reminders($db, $now, $transport) === 1, 'Pengiriman gagal dapat dicoba lagi.');
    $db->exec('DELETE FROM reminder_deliveries');
    $success = false;
    $expired = true;
    verify(dispatch_reminders($db, $now, $transport) === 0, 'Langganan kedaluwarsa tidak terkirim.');
    verify((int) $db->query('SELECT COUNT(*) FROM push_subscriptions')->fetchColumn() === 0, 'Langganan kedaluwarsa dibersihkan.');
    echo "Pengujian pengiriman, deduplikasi, jeda, pemenuhan setoran, retry, dan langganan kedaluwarsa berhasil.\n";
} finally {
    $db->prepare('DELETE FROM albums WHERE id=?')->execute([$album]);
    $db->prepare('DELETE FROM push_subscriptions WHERE id=?')->execute([$subscriptionId]);
}

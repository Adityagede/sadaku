<?php
declare(strict_types=1);
require dirname(__DIR__) . '/php/saving-plan.php';
require dirname(__DIR__) . '/php/push.php';
if (in_array('--calendar', $argv, true)) {
    $cases = json_decode(stream_get_contents(STDIN), true, 16, JSON_THROW_ON_ERROR);
    echo json_encode(array_map(static fn ($case) => ['next' => plan_schedule($case['plan'], $case['date']), 'period' => plan_period($case['plan'], $case['date'])], $cases));
    exit;
}
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$plan = ['frequency' => 'weekly', 'amount' => 100000, 'startDate' => '2026-11-13', 'scheduleDay' => 5, 'reminderEnabled' => true, 'reminderTime' => '19:00', 'paused' => false];
$album = ['id' => 'a', 'balance' => 0, 'target' => 1000000, 'plan' => $plan];
$now = new DateTimeImmutable('2026-11-13T19:00:00+07:00');
check(reminder_due($album, [], $now), 'Pengingat tepat waktu harus terkirim.');
check(!reminder_due($album, [], $now->modify('-1 minute')), 'Pengingat tidak boleh lebih awal.');
check(!reminder_due($album, [], $now->modify('+1 day')), 'Jadwal mingguan tidak dikirim keesokan harinya.');
check(!reminder_due([...$album, 'balance' => 1000000], [], $now), 'Target tercapai menghentikan pengingat.');
check(!reminder_due([...$album, 'plan' => [...$plan, 'paused' => true]], [], $now), 'Rencana jeda tidak mengirim.');
check(!reminder_due([...$album, 'plan' => [...$plan, 'reminderEnabled' => false]], [], $now), 'Pengingat mati tidak mengirim.');
check(reminder_due($album, [], $now->setTimezone(new DateTimeZone('UTC'))), 'Zona waktu pengirim tidak mengubah jam WIB.');
$entries = [['albumId' => 'a', 'type' => 'deposit', 'date' => '2026-11-13', 'amount' => 60000], ['albumId' => 'a', 'type' => 'deposit', 'date' => '2026-11-13', 'amount' => 40000]];
check(!reminder_due($album, $entries, $now), 'Setoran gabungan memenuhi jadwal.');
$key = rtrim(strtr(base64_encode("\x04" . str_repeat('a', 64)), '+/', '-_'), '=');
$auth = rtrim(strtr(base64_encode(str_repeat('b', 16)), '+/', '-_'), '=');
$subscription = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/test', 'keys' => ['p256dh' => $key, 'auth' => $auth]];
check(validate_subscription(json_encode($subscription))['endpoint'] === $subscription['endpoint'], 'Langganan browser valid diterima.');
foreach (['http://fcm.googleapis.com/test', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.evil.test/x', 'https://evil.notify.windows.com.evil.test/x', 'https://fcm.googleapis.com:8443/x', 'https://user@fcm.googleapis.com/x'] as $endpoint) {
    try { validate_subscription(json_encode([...$subscription, 'endpoint' => $endpoint])); throw new RuntimeException('Endpoint tidak aman diterima.'); }
    catch (DomainException) { /* expected */ }
}
echo "Pengujian pengingat dan validasi langganan berhasil.\n";

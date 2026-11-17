<?php
declare(strict_types=1);
require dirname(__DIR__) . '/php/push.php';
require dirname(__DIR__) . '/vendor/autoload.php';

// Exercise real VAPID signing and payload encryption with an HTTP mock. No
// subscription is saved and no request is sent to a browser push service.
$sender = Minishlink\WebPush\VAPID::createVapidKeys();
$recipient = Minishlink\WebPush\VAPID::createVapidKeys();
putenv('VAPID_PUBLIC_KEY=' . $sender['publicKey']);
putenv('VAPID_PRIVATE_KEY=' . $sender['privateKey']);
putenv('VAPID_SUBJECT=https://example.com');
$subscription = validate_subscription(json_encode([
    'endpoint' => 'https://fcm.googleapis.com/fcm/send/offline-test',
    'keys' => ['p256dh' => $recipient['publicKey'], 'auth' => rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=')],
]));
$history = [];
$handler = GuzzleHttp\HandlerStack::create(new GuzzleHttp\Handler\MockHandler([new GuzzleHttp\Psr7\Response(201)]));
$handler->push(GuzzleHttp\Middleware::history($history));
$report = push_client(['handler' => $handler])->sendOneNotification(
    Minishlink\WebPush\Subscription::create($subscription),
    json_encode(['title' => 'Uji Sadaku', 'body' => 'Pesan harus terenkripsi.'])
);
if (!$report->isSuccess() || count($history) !== 1) throw new RuntimeException('Pengiriman mock gagal.');
$request = $history[0]['request'];
if ($request->getHeaderLine('Content-Encoding') !== 'aes128gcm' || !str_starts_with($request->getHeaderLine('Authorization'), 'vapid ')
    || str_contains((string) $request->getBody(), 'Pesan harus terenkripsi.')) throw new RuntimeException('Payload atau tanda tangan Web Push salah.');
echo "Penandatanganan VAPID dan enkripsi payload berhasil dengan HTTP mock, tanpa jaringan.\n";

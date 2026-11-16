<?php
declare(strict_types=1);

require_once __DIR__ . '/environment.php';

function push_status(): array
{
    $public = environment('VAPID_PUBLIC_KEY');
    $private = environment('VAPID_PRIVATE_KEY');
    $subject = environment('VAPID_SUBJECT');
    $ready = is_file(dirname(__DIR__) . '/vendor/autoload.php')
        && preg_match('/^[A-Za-z0-9_-]{87}$/D', $public)
        && preg_match('/^[A-Za-z0-9_-]{43}$/D', $private)
        && (str_starts_with($subject, 'mailto:') || str_starts_with($subject, 'https://'));
    return ['configured' => (bool) $ready, 'publicKey' => $ready ? $public : null];
}

function push_client(array $clientOptions = []): Minishlink\WebPush\WebPush
{
    if (!push_status()['configured']) throw new DomainException('Layanan pengingat belum dikonfigurasi di server.', 503);
    require_once dirname(__DIR__) . '/vendor/autoload.php';
    return new Minishlink\WebPush\WebPush(['VAPID' => [
        'subject' => environment('VAPID_SUBJECT'), 'publicKey' => environment('VAPID_PUBLIC_KEY'),
        'privateKey' => environment('VAPID_PRIVATE_KEY'),
    ]], ['TTL' => 3600, 'urgency' => 'normal'], 10, $clientOptions + ['allow_redirects' => false]);
}

function validate_subscription(string $json): array
{
    try { $value = json_decode($json, true, 8, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new DomainException('Data notifikasi perangkat tidak valid.', 422); }
    $endpoint = is_array($value) ? ($value['endpoint'] ?? null) : null;
    if (!is_string($endpoint) || strlen($endpoint) > 2048) throw new DomainException('Alamat layanan notifikasi tidak valid.', 422);
    $url = parse_url($endpoint);
    $host = strtolower($url['host'] ?? '');
    // Only browser push services are allowed, avoiding arbitrary server-side requests.
    $allowed = in_array($host, ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com'], true)
        || str_ends_with($host, '.notify.windows.com');
    if (!$allowed || ($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass']) || isset($url['fragment']) || (isset($url['port']) && $url['port'] !== 443)) {
        throw new DomainException('Layanan notifikasi browser ini belum didukung.', 422);
    }
    foreach (['p256dh' => 65, 'auth' => 16] as $key => $length) {
        $encoded = $value['keys'][$key] ?? null;
        if (!is_string($encoded) || !preg_match('/^[A-Za-z0-9_-]+={0,2}$/D', $encoded)) throw new DomainException('Kunci notifikasi tidak valid.', 422);
        $decoded = base64_decode(strtr($encoded, '-_', '+/'), true);
        if ($decoded === false || strlen($decoded) !== $length || ($key === 'p256dh' && $decoded[0] !== "\x04")) throw new DomainException('Kunci notifikasi tidak valid.', 422);
    }
    return ['endpoint' => $endpoint, 'keys' => ['p256dh' => $value['keys']['p256dh'], 'auth' => $value['keys']['auth']], 'contentEncoding' => 'aes128gcm'];
}

function send_push(array $subscription, array $payload): object
{
    require_once dirname(__DIR__) . '/vendor/autoload.php';
    return push_client()->sendOneNotification(Minishlink\WebPush\Subscription::create($subscription), json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
}

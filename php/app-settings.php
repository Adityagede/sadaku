<?php
declare(strict_types=1);

require_once __DIR__ . '/environment.php';

function public_app_link(string $key): ?string
{
    $url = trim(environment($key));
    if (!filter_var($url, FILTER_VALIDATE_URL) || preg_match('/[\x00-\x20\x7f]/', $url)) return null;
    $parts = parse_url($url);
    if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) return null;
    return $url;
}

function public_app_settings(): array
{
    return ['rateUrl' => public_app_link('APP_RATE_URL'), 'supportUrl' => public_app_link('APP_SUPPORT_URL')];
}

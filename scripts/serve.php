<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");

if ($path === '/php/api.php') {
    require $root . '/php/api.php';
    return true;
}

$publicFiles = [
    '/' => '/index.html',
    '/index.html' => '/index.html',
    '/assets/css/style.css' => '/assets/css/style.css',
    '/assets/css/interface.css' => '/assets/css/interface.css',
    '/assets/css/theme.css' => '/assets/css/theme.css',
    '/assets/js/theme.js' => '/assets/js/theme.js',
    '/assets/js/main.js' => '/assets/js/main.js',
    '/assets/js/progress.js' => '/assets/js/progress.js',
    '/assets/js/monthly.js' => '/assets/js/monthly.js',
    '/assets/js/monthly-view.js' => '/assets/js/monthly-view.js',
    '/assets/js/navigation.js' => '/assets/js/navigation.js',
    '/assets/js/saving-plan.js' => '/assets/js/saving-plan.js',
    '/assets/js/reminders.js' => '/assets/js/reminders.js',
    '/assets/js/money-input.js' => '/assets/js/money-input.js',
    '/assets/js/activity.js' => '/assets/js/activity.js',
    '/assets/js/entry-context.js' => '/assets/js/entry-context.js',
    '/sw.js' => '/sw.js',
    '/assets/images/favicon.svg' => '/assets/images/favicon.svg',
    '/assets/images/album-cover.svg' => '/assets/images/album-cover.svg',
];

if (!isset($publicFiles[$path])) {
    http_response_code(404);
    echo 'Halaman tidak ditemukan.';
    return true;
}

$file = $root . $publicFiles[$path];
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'svg' => 'image/svg+xml'];
header('Content-Type: ' . $types[pathinfo($file, PATHINFO_EXTENSION)]);
readfile($file);
return true;

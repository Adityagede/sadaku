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
    '/assets/js/app.js' => '/assets/js/app.js',
    '/assets/js/components/activity-list.js' => '/assets/js/components/activity-list.js',
    '/assets/js/components/activity-motion.js' => '/assets/js/components/activity-motion.js',
    '/assets/js/components/album-display.js' => '/assets/js/components/album-display.js',
    '/assets/js/components/app-menu.js' => '/assets/js/components/app-menu.js',
    '/assets/js/components/dialog.js' => '/assets/js/components/dialog.js',
    '/assets/js/components/dom.js' => '/assets/js/components/dom.js',
    '/assets/js/components/money-form.js' => '/assets/js/components/money-form.js',
    '/assets/js/components/money-input.js' => '/assets/js/components/money-input.js',
    '/assets/js/components/navigation.js' => '/assets/js/components/navigation.js',
    '/assets/js/components/theme.js' => '/assets/js/components/theme.js',
    '/assets/js/data/backup.js' => '/assets/js/data/backup.js',
    '/assets/js/data/data-source.js' => '/assets/js/data/data-source.js',
    '/assets/js/data/local-store.js' => '/assets/js/data/local-store.js',
    '/assets/js/data/reminders.js' => '/assets/js/data/reminders.js',
    '/assets/js/domain/activity.js' => '/assets/js/domain/activity.js',
    '/assets/js/domain/currency.js' => '/assets/js/domain/currency.js',
    '/assets/js/domain/dates.js' => '/assets/js/domain/dates.js',
    '/assets/js/domain/entry-context.js' => '/assets/js/domain/entry-context.js',
    '/assets/js/domain/monthly.js' => '/assets/js/domain/monthly.js',
    '/assets/js/domain/progress.js' => '/assets/js/domain/progress.js',
    '/assets/js/domain/saving-plan.js' => '/assets/js/domain/saving-plan.js',
    '/assets/js/domain/wallet.js' => '/assets/js/domain/wallet.js',
    '/assets/js/pages/album-form.js' => '/assets/js/pages/album-form.js',
    '/assets/js/pages/albums.js' => '/assets/js/pages/albums.js',
    '/assets/js/pages/backup.js' => '/assets/js/pages/backup.js',
    '/assets/js/pages/entry-form.js' => '/assets/js/pages/entry-form.js',
    '/assets/js/pages/history.js' => '/assets/js/pages/history.js',
    '/assets/js/pages/overview.js' => '/assets/js/pages/overview.js',
    '/assets/js/pages/settings.js' => '/assets/js/pages/settings.js',
    '/assets/js/pages/statistics-view.js' => '/assets/js/pages/statistics-view.js',
    '/assets/js/pages/statistics.js' => '/assets/js/pages/statistics.js',
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

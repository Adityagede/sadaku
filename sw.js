// Only the public application shell is cached. API responses and user backups
// must always pass through their normal storage/authentication paths.
const shellPrefix = `sadaku-shell:${self.registration.scope}:`;
const shellCache = `${shellPrefix}4`;
const shellFiles = [
    './',
    'index.html',
    'assets/css/style.css',
    'assets/css/interface.css',
    'assets/css/theme.css',
    'assets/js/app.js',
    'assets/js/components/activity-list.js',
    'assets/js/components/activity-motion.js',
    'assets/js/components/album-display.js',
    'assets/js/components/app-menu.js',
    'assets/js/components/dialog.js',
    'assets/js/components/dom.js',
    'assets/js/components/money-form.js',
    'assets/js/components/money-input.js',
    'assets/js/components/navigation.js',
    'assets/js/components/theme.js',
    'assets/js/data/backup.js',
    'assets/js/data/data-source.js',
    'assets/js/data/local-store.js',
    'assets/js/data/reminders.js',
    'assets/js/domain/activity.js',
    'assets/js/domain/currency.js',
    'assets/js/domain/dates.js',
    'assets/js/domain/entry-context.js',
    'assets/js/domain/monthly.js',
    'assets/js/domain/progress.js',
    'assets/js/domain/saving-plan.js',
    'assets/js/domain/wallet.js',
    'assets/js/pages/album-form.js',
    'assets/js/pages/albums.js',
    'assets/js/pages/backup.js',
    'assets/js/pages/entry-form.js',
    'assets/js/pages/history.js',
    'assets/js/pages/overview.js',
    'assets/js/pages/settings.js',
    'assets/js/pages/statistics-view.js',
    'assets/js/pages/statistics.js',
    'assets/images/favicon.svg',
    'assets/images/album-cover.svg',
].map(path => new URL(path, self.registration.scope).href);
const shellPaths = new Set(shellFiles.map(url => new URL(url).pathname));
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(shellCache);
        await cache.addAll(shellFiles);
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name.startsWith(shellPrefix) && name !== shellCache) await caches.delete(name);
        await self.clients.claim();
    })());
});
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || !shellPaths.has(url.pathname)) return;
    const key = `${url.origin}${url.pathname}`;
    event.respondWith((async () => {
        const cache = await caches.open(shellCache);
        try {
            const response = await fetch(event.request);
            if (response.ok) { try { await cache.put(key, response.clone()); } catch { /* Network response remains usable if the cache is full. */ } }
            return response;
        } catch (error) {
            const cached = await cache.match(key);
            if (cached) return cached;
            throw error;
        }
    })());
});

self.addEventListener('push', event => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Display a useful fallback for malformed payloads. */ }
    event.waitUntil(self.registration.showNotification(payload.title || 'Pengingat Sadaku', {
        body: payload.body || 'Lihat jadwal menabung di albummu.',
        tag: payload.tag || 'sadaku-reminder',
        data: { url: payload.url || './' },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || './', self.registration.scope);
    if (target.origin !== self.location.origin) return;
    target.searchParams.set('storage', 'server');
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = windows.find(client => new URL(client.url).pathname === target.pathname);
        if (existing) {
            await existing.navigate(target.href);
            return existing.focus();
        }
        return self.clients.openWindow(target.href);
    })());
});

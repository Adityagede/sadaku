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

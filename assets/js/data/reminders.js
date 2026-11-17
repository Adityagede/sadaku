export function createDeviceNotifications({ request, changed }) {
    let subscription = null;
    let registered = false;
    let config = { configured: false };
    const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const body = values => { const form = new FormData(); for (const [key, value] of Object.entries(values)) form.set(key, value); return form; };
    let registration;
    async function worker() {
        if (!registration) registration = await navigator.serviceWorker.register('sw.js');
        return navigator.serviceWorker.ready;
    }
    function status() {
        if (config.local) return { active: false, canEnable: false, message: 'Rencana menabung tersimpan di perangkat ini. Pengingat saat aplikasi tertutup belum tersedia untuk mode ini.' };
        if (!supported()) return { active: false, canEnable: false, message: 'Notifikasi belum didukung di browser ini. Gunakan browser yang mendukung dan koneksi HTTPS. Di iPhone/iPad, buka Sadaku dari Layar Utama.' };
        if (!config.configured) return { active: false, canEnable: false, message: 'Layanan pengingat belum diaktifkan di server. Rencana dan jam pilihanmu tetap dapat disimpan.' };
        if (Notification.permission === 'denied') return { active: false, canEnable: false, message: 'Izin notifikasi diblokir. Izinkan Sadaku melalui pengaturan situs di browser, lalu aktifkan kembali di sini.' };
        const active = registered && Notification.permission === 'granted';
        return { active, canEnable: !active, message: active ? 'Notifikasi aktif di perangkat ini. Pengingat dikirim sesuai jadwal album selama layanan pengingat server berjalan.' : 'Notifikasi perangkat ini belum aktif. Aktifkan untuk menerima pengingat sesuai jadwal album.' };
    }
    async function refresh(nextConfig = config) {
        config = nextConfig;
        try {
            if (supported() && config.configured) {
                subscription = await (await worker()).pushManager.getSubscription();
                registered = subscription ? (await request('push_device', body({ endpoint: subscription.endpoint }))).registered : false;
            } else registered = false;
        } catch { registered = false; }
        changed();
    }
    async function enable() {
        if (!status().canEnable) throw new Error(status().message);
        // Ask synchronously from the user's click, before waiting for registration.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { changed(); throw new Error('Notifikasi belum diizinkan. Rencana tetap dapat disimpan tanpa notifikasi perangkat.'); }
        const ready = await worker();
        subscription = await ready.pushManager.getSubscription();
        if (!subscription) {
            const raw = atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
            subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) });
        }
        await request('subscribe_push', body({ subscription: JSON.stringify(subscription.toJSON()) }));
        registered = true;
        changed();
    }
    async function disable() {
        if (subscription) {
            await request('unsubscribe_push', body({ endpoint: subscription.endpoint }));
            registered = false;
            changed();
            await subscription.unsubscribe();
        }
        subscription = null;
        registered = false;
        changed();
    }
    async function test() {
        if (!subscription || !status().active) throw new Error('Aktifkan notifikasi perangkat terlebih dahulu.');
        await request('test_push', body({ endpoint: subscription.endpoint }));
    }
    return { status, refresh, enable, disable, test };
}

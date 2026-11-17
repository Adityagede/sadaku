import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceNotifications } from '../assets/js/data/reminders.js';

function fixture(t, { permission = 'default', failSave = false } = {}) {
    const original = Object.fromEntries(['navigator', 'window', 'Notification'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    t.after(() => { for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
    let permissionCalls = 0;
    let registered = false;
    let subscription = null;
    const calls = [];
    const notification = { permission, requestPermission: async () => { permissionCalls++; notification.permission = 'granted'; return 'granted'; } };
    const ready = { pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => (subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', toJSON: () => ({}), unsubscribe: async () => { subscription = null; return true; } }),
    } };
    for (const [key, value] of Object.entries({ window: { isSecureContext: true, PushManager: {}, Notification: notification }, Notification: notification, navigator: { serviceWorker: { register: async () => ready, ready: Promise.resolve(ready) } } })) Object.defineProperty(globalThis, key, { configurable: true, value });
    const device = createDeviceNotifications({ changed: () => {}, request: async action => {
        calls.push(action);
        if (action === 'subscribe_push') { if (failSave) throw new Error('Simpan gagal'); registered = true; }
        if (action === 'unsubscribe_push') registered = false;
        return { registered };
    } });
    return { device, calls, permissions: () => permissionCalls };
}
const config = { configured: true, publicKey: 'B'.repeat(87) };
test('Memuat status tidak meminta izin; aktivasi berhasil setelah server menyimpan langganan', async t => {
    const { device, permissions, calls } = fixture(t);
    await device.refresh(config);
    assert.equal(permissions(), 0);
    assert.equal(device.status().active, false);
    await device.enable();
    assert.equal(permissions(), 1);
    assert.equal(device.status().active, true);
    assert.ok(calls.includes('subscribe_push'));
    await device.test();
    assert.ok(calls.includes('test_push'));
    await device.disable();
    assert.equal(device.status().active, false);
    assert.ok(calls.includes('unsubscribe_push'));
});
test('Kegagalan menyimpan langganan tidak mengklaim notifikasi aktif', async t => {
    const { device } = fixture(t, { failSave: true });
    await device.refresh(config);
    await assert.rejects(device.enable(), /Simpan gagal/);
    assert.equal(device.status().active, false);
});
test('Izin diblokir dan server belum dikonfigurasi tidak memunculkan permintaan izin', async t => {
    const { device, permissions } = fixture(t, { permission: 'denied' });
    await device.refresh(config);
    assert.equal(device.status().canEnable, false);
    await assert.rejects(device.enable(), /diblokir/);
    await device.refresh({ configured: false });
    assert.match(device.status().message, /belum diaktifkan di server/);
    assert.equal(permissions(), 0);
});
test('Notifikasi uji hanya tersedia untuk perangkat yang terdaftar', async t => {
    const { device, calls } = fixture(t);
    await device.refresh(config);
    await assert.rejects(device.test(), /Aktifkan/);
    assert.equal(calls.includes('test_push'), false);
});

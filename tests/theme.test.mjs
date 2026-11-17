import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/js/components/theme.js', import.meta.url), 'utf8');
function fixture({ saved = null, dark = false, blocked = false } = {}) {
    const listeners = {};
    const media = { matches: dark, addEventListener: (name, callback) => { listeners.media = callback; } };
    const root = { dataset: {}, style: {} };
    const meta = {};
    const events = [];
    const storage = new Map(saved === null ? [] : [['sadaku.theme', saved]]);
    const window = {
        matchMedia: () => media,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        dispatchEvent: event => events.push(event),
    };
    vm.runInNewContext(source, {
        window,
        document: { documentElement: root, querySelector: () => ({ setAttribute: (name, value) => { meta[name] = value; } }) },
        localStorage: {
            getItem: key => { if (blocked) throw new Error('Blocked'); return storage.get(key) ?? null; },
            setItem: (key, value) => { if (blocked) throw new Error('Blocked'); storage.set(key, value); },
        },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    });
    return { theme: window.SadakuTheme, media, listeners, root, meta, events, storage };
}

test('pilihan tersimpan diterapkan sebelum modul aplikasi dimuat', () => {
    const { root, meta, theme } = fixture({ saved: 'dark' });
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(meta.content, '#121b17');
    assert.equal(theme.getPreference(), 'dark');
});

test('mode perangkat mengikuti perubahan sistem, pilihan manual tetap bertahan', () => {
    const { theme, media, listeners, root, storage } = fixture();
    assert.equal(root.dataset.theme, 'light');
    media.matches = true;
    listeners.media();
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(theme.setPreference('light'), true);
    listeners.media();
    assert.equal(root.dataset.theme, 'light');
    assert.equal(storage.get('sadaku.theme'), 'light');
    theme.setPreference('system');
    assert.equal(root.dataset.theme, 'dark');
});

test('penyimpanan diblokir tetap memungkinkan perubahan tema tanpa error aplikasi', () => {
    const { theme, root, events } = fixture({ blocked: true });
    assert.equal(theme.setPreference('dark'), false);
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(events.at(-1).detail.preference, 'dark');
});

test('perubahan dari tab lain dan penghapusan preferensi disinkronkan', () => {
    const { listeners, root, theme } = fixture({ saved: 'dark' });
    listeners.storage({ key: 'unrelated', newValue: 'light' });
    assert.equal(root.dataset.theme, 'dark');
    listeners.storage({ key: 'sadaku.theme', newValue: 'light' });
    assert.equal(root.dataset.theme, 'light');
    listeners.storage({ key: null, newValue: null });
    assert.equal(theme.getPreference(), 'system');
});

test('nilai tidak valid tidak menjadi tema atau preferensi baru', () => {
    const { theme, root } = fixture({ saved: 'invalid', dark: true });
    assert.equal(theme.getPreference(), 'system');
    assert.equal(theme.setPreference('invalid'), false);
    assert.equal(root.dataset.theme, 'dark');
});

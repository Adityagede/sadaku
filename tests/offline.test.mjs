import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function fixture() {
    const handlers = new Map();
    const stored = new Map();
    const installed = [];
    const deleted = [];
    const cache = { addAll: async urls => { installed.push(...urls); }, put: async (key, response) => stored.set(key, response), match: async key => stored.get(key) };
    const scope = 'https://sadaku.example/app/';
    const prefix = `sadaku-shell:${scope}:`;
    const context = { URL, Response, caches: { open: async () => cache, keys: async () => [`${prefix}0`, `${prefix}1`, `${prefix}2`, `${prefix}3`, `${prefix}4`, 'other-app'], delete: async key => deleted.push(key) },
        fetch: async () => new Response('public-shell'),
        self: { registration: { scope }, location: { origin: 'https://sadaku.example' }, skipWaiting: async () => {}, clients: { claim: async () => {} }, addEventListener: (type, handler) => handlers.set(type, handler) } };
    runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
    return { handlers, context, stored, installed, deleted, prefix };
}

test('Offline cache hanya berisi shell publik dan semua file tersedia pada router lokal', async () => {
    const f = fixture();
    let work;
    f.handlers.get('install')({ waitUntil: value => { work = value; } });
    await work;
    assert.ok(f.installed.length > 15);
    const router = readFileSync(new URL('../scripts/serve.php', import.meta.url), 'utf8');
    for (const url of f.installed) {
        assert.equal(/php\/|\.env|backup|storage|vendor|database/.test(new URL(url).pathname.replace(/assets\/js\/(data|pages)\/backup\.js$/, '')), false, url);
        const path = new URL(url).pathname.replace('/app/', '/');
        assert.ok(router.includes(`'${path}'`), path);
    }
});

test('API, gambar privat, unggahan, dan origin lain tidak dicegat service worker', () => {
    const f = fixture();
    for (const [url, method] of [['https://sadaku.example/app/php/api.php', 'GET'], ['https://sadaku.example/app/php/api.php?action=image&id=x', 'GET'], ['https://sadaku.example/app/', 'POST'], ['https://elsewhere.example/app/', 'GET'], ['https://sadaku.example/app/.env', 'GET']]) {
        f.handlers.get('fetch')({ request: { url, method }, respondWith() { assert.fail(url); } });
    }
});

test('Shell dapat dibuka dari cache saat offline; respons gagal tidak mengganti cache', async () => {
    const f = fixture();
    const request = { url: 'https://sadaku.example/app/?ignored=value', method: 'GET' };
    async function load() {
        let response;
        f.handlers.get('fetch')({ request, respondWith: promise => { response = promise; } });
        return response;
    }
    assert.equal(await (await load()).text(), 'public-shell');
    f.context.fetch = async () => new Response('login-required', { status: 401 });
    assert.equal((await load()).status, 401);
    f.context.fetch = async () => { throw new Error('offline'); };
    assert.equal(await (await load()).text(), 'public-shell');
});

test('Aktivasi hanya menghapus cache lama milik scope aplikasi yang sama', async () => {
    const f = fixture();
    let work;
    f.handlers.get('activate')({ waitUntil: value => { work = value; } });
    await work;
    assert.deepEqual(f.deleted, [`${f.prefix}0`, `${f.prefix}1`, `${f.prefix}2`, `${f.prefix}3`]);
});

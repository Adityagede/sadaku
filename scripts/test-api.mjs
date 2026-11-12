import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

async function fetch(url, options = {}) {
    const headers = { ...options.headers, Connection: 'close' };
    let body = null;
    if (options.body) {
        const encoded = new Request(url, { method: 'POST', body: options.body });
        headers['Content-Type'] = encoded.headers.get('content-type');
        body = Buffer.from(await encoded.arrayBuffer());
        headers['Content-Length'] = body.length;
    }
    return new Promise((resolve, reject) => {
        const request = httpRequest(url, { method: options.method || 'GET', headers }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('error', reject);
            response.on('end', () => {
                const bytes = Buffer.concat(chunks);
                resolve({
                    status: response.statusCode,
                    headers: { get: name => {
                        const value = response.headers[name.toLowerCase()];
                        return Array.isArray(value) ? value[0] : value;
                    } },
                    json: async () => JSON.parse(bytes.toString()),
                    text: async () => bytes.toString(),
                    arrayBuffer: async () => bytes,
                });
            });
        });
        request.on('error', reject);
        request.end(body);
    });
}

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
if (process.env.SADAKU_ISOLATED_TEST !== '1') {
    throw new Error('Jalankan melalui npm test agar pengujian memakai MySQL sementara yang terpisah.');
}
// Mode produksi juga memeriksa layout filesystem yang dipakai Dockerfile.
const runtime = process.env.APP_ENV === 'production' ? resolve(root, `.test-storage-runtime-${port}`) : null;
if (runtime) {
    await mkdir(join(runtime, 'public', 'php'), { recursive: true });
    await mkdir(join(runtime, 'public', 'assets', 'css'), { recursive: true });
    await cp(join(root, 'php'), join(runtime, 'php'), { recursive: true });
    await cp(join(root, 'index.html'), join(runtime, 'public', 'index.html'));
    await cp(join(root, 'deployment', 'api.php'), join(runtime, 'public', 'php', 'api.php'));
    for (const file of ['style.css', 'interface.css']) {
        await cp(join(root, 'assets', 'css', file), join(runtime, 'public', 'assets', 'css', file));
    }
    for (const directory of ['js', 'images']) {
        await cp(join(root, 'assets', directory), join(runtime, 'public', 'assets', directory), { recursive: true });
    }
    // Server bawaan PHP jatuh ke index.html untuk sebagian URL yang tidak ada.
    // Hindari fallback tersebut agar pemeriksaan file privat tetap menguji 404.
    await writeFile(join(runtime, 'router.php'), `<?php
        $path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
        if ($path === '/' || is_file($_SERVER['DOCUMENT_ROOT'] . $path)) return false;
        http_response_code(404);
        echo 'Halaman tidak ditemukan.';
    `);
}
const server = spawn('php', ['-d', 'upload_max_filesize=5M', '-d', 'post_max_size=6M', '-S', `127.0.0.1:${port}`, ...(runtime ? ['-t', join(runtime, 'public'), join(runtime, 'router.php')] : ['scripts/serve.php'])], {
    cwd: runtime || root,
    env: process.env,
    stdio: ['ignore', 'ignore', 'pipe']
});
let serverLog = '';
server.stderr.on('data', chunk => { serverLog += chunk; });
let cookie = '';
let csrf = '';
let checks = 0;

async function api(action = 'state', values = null, expectedStatus = 200, token = csrf) {
    const body = values ? new FormData() : null;
    if (values) for (const [key, value] of Object.entries(values)) {
        if (value instanceof Blob) body.set(key, value, value.type === 'image/png' ? 'cover.png' : 'invalid.svg');
        else body.set(key, String(value));
    }
    const response = await fetch(`${base}/php/api.php?action=${action}`, {
        method: body ? 'POST' : 'GET',
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'X-CSRF-Token': token } : {}) },
        body
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const result = await response.json();
    assert.equal(response.status, expectedStatus, JSON.stringify(result));
    checks++;
    return result;
}

try {
    for (let attempt = 0; attempt < 50; attempt++) {
        try { await fetch(`${base}/`); break; } catch { await delay(100); }
    }
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Sadaku/);
    for (const asset of ['assets/css/style.css', 'assets/css/interface.css', 'assets/js/main.js', 'assets/js/progress.js', 'assets/js/monthly.js', 'assets/js/monthly-view.js', 'assets/js/navigation.js', 'assets/images/album-cover.svg']) {
        assert.equal((await fetch(`${base}/${asset}`)).status, 200);
    }
    for (const privatePath of ['storage/sadaku.sqlite', 'php/database.php', 'php/environment.php', 'php/csrf.php', '.env', '.env.example', 'database/schema.sql', 'SOP.md', '.gitignore', 'package.json', 'scripts/serve.php', 'Dockerfile', 'Caddyfile', '.dockerignore', 'deployment/entrypoint.sh', 'deployment/api.php', 'DEPLOYMENT.md']) {
        assert.equal((await fetch(`${base}/${privatePath}`)).status, 404, privatePath);
        checks++;
    }
    let state = await api();
    csrf = state.csrf;
    assert.equal(state.albums.length, 0);
    assert.equal((await api()).csrf, csrf, 'Token stabil antarpermintaan');
    if (process.env.APP_ENV === 'production') {
        assert.match(cookie, /^__Host-sadaku_csrf=/);
        const originalCookie = cookie;
        cookie = originalCookie + 'a';
        await api('save_album', { name: 'Cookie palsu', target: 500, color: 'sage' }, 403);
        cookie = originalCookie;
    }
    await api('save_album', { name: 'Tanpa token', target: 500, color: 'sage' }, 403, '');
    await api('save_album', { name: ' ', target: 500, color: 'sage' }, 422);
    await api('save_album', { name: 'Negatif', target: -1, color: 'sage' }, 422);
    await api('save_album', { name: 'Tanggal', target: 500, color: 'sage', deadline: '2026-02-30' }, 422);
    await api('save_album', { name: 'Warna', target: 500, color: 'invalid' }, 422);
    await api('save_album', { name: 'SVG', target: 500, color: 'sage', image: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }) }, 422);
    await api('save_album', { name: 'Gambar rusak', target: 500, color: 'sage', image: new Blob(['not an image'], { type: 'image/png' }) }, 422);
    await api('save_album', { name: 'Gambar terlalu besar', target: 500, color: 'sage', image: new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: 'image/png' }) }, 422);
    await api('save_album', { name: 'Payload terlalu besar', target: 500, color: 'sage', image: new Blob([new Uint8Array(4352 * 1024)], { type: 'image/png' }) }, 413);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OAAAAABJRU5ErkJggg==', 'base64');
    const image = new Blob([png], { type: 'image/png' });
    state = await api('save_album', { name: 'Target iPhone 17 Pro Max', target: 25000000, color: 'peach', motivation: 'Untuk foto keluarga', image });
    const albumId = state.savedId;
    assert.ok(state.albums[0].imageVersion);
    assert.equal(state.albums[0].balance, 0);
    const photo = await fetch(`${base}/php/api.php?action=image&id=${albumId}`, { headers: { Cookie: cookie } });
    assert.equal(photo.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
    checks++;

    state = await api('save_album', { id: albumId, name: 'Motor sendiri', target: 30000000, color: 'lilac', deadline: '2027-12-31', motivation: 'Perjalanan kerja lebih nyaman' });
    assert.equal(state.albums[0].name, 'Motor sendiri');
    assert.ok(state.albums[0].imageVersion, 'Gambar tetap ada saat edit tanpa upload');
    const savedAgain = await api();
    assert.equal(savedAgain.albums[0].name, 'Motor sendiri', 'Data bertahan antarpermintaan');

    state = await api('save_entry', { album_id: albumId, type: 'deposit', amount: 500000, date: '2026-01-01', note: 'Setoran pertama <script>' });
    const depositId = state.savedId;
    assert.equal(state.albums[0].balance, 500000);
    assert.equal(state.entries[0].note, 'Setoran pertama <script>');
    await api('save_entry', { album_id: albumId, type: 'withdrawal', amount: 600000, date: '2026-01-02' }, 422);
    await api('save_entry', { album_id: albumId, type: 'withdrawal', amount: 100000, date: '2025-12-31' }, 422);
    await api('save_entry', { album_id: albumId, type: 'deposit', amount: 100, date: '2200-01-01' }, 422);
    state = await api('save_entry', { album_id: albumId, type: 'withdrawal', amount: 100000, date: '2026-01-02', note: 'Keperluan mendadak' });
    const withdrawalId = state.savedId;
    assert.equal(state.albums[0].balance, 400000);
    await api('save_entry', { id: depositId, album_id: albumId, type: 'deposit', amount: 50000, date: '2026-01-01' }, 422);
    await api('delete_entry', { id: depositId }, 422);
    state = await api();
    assert.equal(state.albums[0].balance, 400000, 'Transaksi gagal tidak mengubah saldo');
    assert.equal(state.entries.length, 2);
    state = await api('save_entry', { id: withdrawalId, album_id: albumId, type: 'withdrawal', amount: 200000, date: '2026-01-02', note: 'Revisi penarikan' });
    assert.equal(state.albums[0].balance, 300000);
    state = await api('delete_entry', { id: withdrawalId });
    assert.equal(state.albums[0].balance, 500000);
    state = await api('save_album', { id: albumId, name: 'Motor sendiri', target: 400000, color: 'sand', remove_image: 1 });
    assert.equal(state.albums[0].imageVersion, null);
    assert.ok(state.albums[0].balance >= state.albums[0].target);
    assert.equal((await fetch(`${base}/php/api.php?action=image&id=${albumId}`)).status, 404);

    const second = await api('save_album', { name: 'Dana perjalanan', target: 1000000, color: 'sage' });
    const secondId = second.savedId;
    await api('save_entry', { id: depositId, album_id: secondId, type: 'deposit', amount: 500000, date: '2026-01-01' }, 422);
    state = await api('save_entry', { album_id: secondId, type: 'deposit', amount: 250000, date: '2026-01-01' });
    assert.equal(state.albums.find(album => album.id === albumId).balance, 500000);
    assert.equal(state.albums.find(album => album.id === secondId).balance, 250000);
    state = await api('delete_album', { id: albumId });
    assert.equal(state.albums.length, 1);
    assert.equal(state.entries.length, 1, 'Catatan album dihapus bersama albumnya');
    assert.equal(state.entries[0].albumId, secondId);
    await api('delete_album', { id: albumId }, 404);
    state = await api('delete_album', { id: secondId });
    assert.equal(state.albums.length, 0);
    assert.equal(state.entries.length, 0);
    assert.doesNotMatch(serverLog, /PHP (?:Warning|Fatal|Parse|Notice)/);
    console.log(`Lulus ${checks} pemeriksaan API: CRUD album/catatan, persistensi, gambar, validasi saldo, CSRF, dan pembatasan file privat.`);
} finally {
    server.kill();
    if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
    if (runtime) {
        if (!runtime.startsWith(resolve(root) + sep) || !runtime.split(sep).at(-1).startsWith('.test-storage-runtime-')) {
            throw new Error('Path pembersihan runtime tidak valid.');
        }
        await rm(runtime, { recursive: true, force: true });
    }
}

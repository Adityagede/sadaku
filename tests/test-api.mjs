import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
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
function todayWib() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function historicalEntry(id, date) {
    execFileSync('php', ['tests/set-test-entry-date.php', id, date], { cwd: root, env: process.env });
}
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
    await cp(join(root, 'sw.js'), join(runtime, 'public', 'sw.js'));
    await cp(join(root, 'deployment', 'api.php'), join(runtime, 'public', 'php', 'api.php'));
    for (const file of ['style.css', 'interface.css', 'theme.css']) {
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
    for (const asset of ['assets/css/style.css', 'assets/css/interface.css', 'assets/css/theme.css', 'assets/js/components/theme.js', 'assets/js/app.js', 'assets/js/domain/progress.js', 'assets/js/domain/monthly.js', 'assets/js/pages/statistics-view.js', 'assets/js/components/navigation.js', 'assets/js/domain/saving-plan.js', 'assets/js/data/reminders.js', 'assets/js/components/money-input.js', 'assets/js/domain/activity.js', 'assets/js/domain/entry-context.js', 'sw.js', 'assets/images/album-cover.svg']) {
        assert.equal((await fetch(`${base}/${asset}`)).status, 200);
    }
    for (const privatePath of ['storage/sadaku.sqlite', 'php/database.php', 'php/environment.php', 'php/csrf.php', 'php/push.php', 'php/saving-plan.php', 'php/app-settings.php', 'vendor/autoload.php', 'composer.json', 'composer.lock', 'scripts/send-reminders.php', 'scripts/setup-push.php', 'scripts/php.mjs', '.env', '.env.example', 'database/schema.sql', 'SOP.md', '.gitignore', 'package.json', 'scripts/serve.php', 'Dockerfile', 'Caddyfile', '.dockerignore', 'deployment/entrypoint.sh', 'deployment/api.php', 'DEPLOYMENT.md']) {
        assert.equal((await fetch(`${base}/${privatePath}`)).status, 404, privatePath);
        checks++;
    }
    let state = await api();
    csrf = state.csrf;
    assert.equal(state.albums.length, 0);
    assert.deepEqual(state.settings, { rateUrl: 'https://play.google.com/store/apps/details?id=example.sadaku', supportUrl: 'https://example.org/support' });
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
    const creationValues = { name: 'Album dengan rencana', target: 500000, color: 'sage', plan_enabled: 1, plan_frequency: 'daily', plan_amount: 50000, plan_start_date: '2026-11-13', plan_schedule_day: 1, plan_reminder_enabled: 1, plan_reminder_time: '20:30' };
    for (const frequency of ['daily', 'weekly', 'monthly']) {
        state = await api('save_album', { ...creationValues, plan_frequency: frequency, plan_schedule_day: frequency === 'monthly' ? 31 : 1 });
        const created = state.albums.find(album => album.id === state.savedId);
        assert.equal(created.plan.frequency, frequency, 'Rencana tersimpan saat membuat album');
        assert.equal(created.plan.amount, 50000);
        assert.equal(created.plan.reminderTime, '20:30');
        assert.equal(created.balance, 0, 'Rencana tidak membuat setoran');
        const editing = { ...creationValues, id: created.id, name: 'Album direvisi', plan_amount: 75000, plan_frequency: frequency, plan_schedule_day: frequency === 'monthly' ? 31 : 1, plan_reminder_enabled: 0 };
        state = await api('save_album', editing);
        assert.equal(state.albums.find(album => album.id === created.id).plan.amount, 75000);
        assert.equal(state.albums.find(album => album.id === created.id).plan.reminderEnabled, false);
        await api('save_album', { ...editing, name: 'Tidak boleh tersimpan', plan_amount: -1 }, 422);
        assert.equal((await api()).albums.find(album => album.id === created.id).name, 'Album direvisi', 'Album tidak berubah jika rencana tidak valid');
        state = await api('save_album', { ...editing, plan_enabled: 0 });
        assert.equal(state.albums.find(album => album.id === created.id).plan, null);
        await api('delete_album', { id: created.id });
    }
    for (const invalid of [{ plan_amount: 0 }, { plan_amount: '50.000' }, { plan_frequency: 'yearly' }, { plan_reminder_time: '25:00' }, { plan_start_date: '2026-02-30' }, { plan_enabled: 2 }]) {
        await api('save_album', { ...creationValues, ...invalid }, 422);
        assert.equal((await api()).albums.length, 0, 'Album tidak dibuat setengah jadi');
    }
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
    assert.equal(savedAgain.albums[0].plan, null);
    const planValues = { album_id: albumId, frequency: 'weekly', amount: 100000, start_date: '2026-11-13', schedule_day: 5, reminder_enabled: 1, reminder_time: '19:30', paused: 0 };
    await api('save_plan', planValues, 403, '');
    for (const invalid of [{ frequency: 'yearly' }, { amount: 0 }, { amount: '1.5' }, { start_date: '2026-02-30' }, { schedule_day: 7 }, { schedule_day: '-1' }, { frequency: 'monthly', schedule_day: 0 }, { frequency: 'monthly', schedule_day: 32 }, { reminder_time: '24:00' }, { paused: 2 }, { reminder_enabled: 2 }]) {
        await api('save_plan', { ...planValues, ...invalid }, 422);
    }
    await api('save_plan', { ...planValues, album_id: 'a'.repeat(24) }, 404);
    state = await api('save_plan', planValues);
    assert.deepEqual(state.albums[0].plan, { frequency: 'weekly', amount: 100000, startDate: '2026-11-13', scheduleDay: 5, reminderEnabled: true, reminderTime: '19:30', paused: false });
    assert.equal(state.albums[0].balance, 0, 'Menyimpan rencana tidak membuat setoran');
    assert.deepEqual((await api()).albums[0].plan, state.albums[0].plan, 'Rencana persisten');
    state = await api('save_plan', { ...planValues, frequency: 'monthly', schedule_day: 31, paused: 1, reminder_enabled: 0 });
    assert.equal(state.albums[0].plan.paused, true);
    assert.equal(state.albums[0].plan.reminderEnabled, false);
    assert.equal(state.albums[0].plan.scheduleDay, 31);
    await api('test_push', { endpoint: 'https://fcm.googleapis.com/fcm/send/not-registered' }, 422);
    assert.equal((await api('push_device', { endpoint: 'https://fcm.googleapis.com/fcm/send/not-registered' })).registered, false);
    await api('unsubscribe_push', { endpoint: 'https://fcm.googleapis.com/fcm/send/not-registered' });
    const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/sadaku-test', keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') } };
    if (savedAgain.push.configured) {
        await api('subscribe_push', { subscription: JSON.stringify({ ...subscription, endpoint: 'https://127.0.0.1/private' }) }, 422);
        await api('subscribe_push', { subscription: JSON.stringify(subscription) });
        await api('subscribe_push', { subscription: JSON.stringify(subscription) });
        assert.equal((await api('push_device', { endpoint: subscription.endpoint })).registered, true);
        await api('unsubscribe_push', { endpoint: subscription.endpoint });
        assert.equal((await api('push_device', { endpoint: subscription.endpoint })).registered, false);
    } else {
        await api('subscribe_push', { subscription: JSON.stringify(subscription) }, 503);
    }

    const beforeSave = todayWib();
    state = await api('save_entry', { album_id: albumId, type: 'deposit', amount: 500000, note: 'Setoran pertama <script>' });
    const depositId = state.savedId;
    const savedDeposit = state.entries.find(entry => entry.id === depositId);
    assert.ok(new Set([beforeSave, todayWib()]).has(savedDeposit.date), 'Tanggal baru otomatis mengikuti server WIB tanpa isian tanggal');
    assert.equal(savedDeposit.createdAt.slice(0, 10), savedDeposit.date, 'Tanggal dan waktu pencatatan berasal dari satu waktu server');
    assert.equal(state.albums[0].balance, 500000);
    assert.equal(state.entries[0].note, 'Setoran pertama <script>');
    await api('save_entry', { album_id: albumId, type: 'withdrawal', amount: 600000, date: '2026-01-02' }, 422);
    for (const date of ['2200-01-01', '1900-01-01', 'not-a-date']) {
        const before = todayWib();
        const tampered = await api('save_entry', { album_id: albumId, type: 'deposit', amount: 100, date });
        assert.ok(new Set([before, todayWib()]).has(tampered.entries.find(entry => entry.id === tampered.savedId).date), 'Tanggal kiriman browser tidak mengubah tanggal otomatis server');
        await api('delete_entry', { id: tampered.savedId });
    }
    historicalEntry(depositId, '2026-01-01');
    state = await api('save_entry', { album_id: albumId, type: 'withdrawal', amount: 100000, date: '2026-01-02', note: 'Keperluan mendadak' });
    const withdrawalId = state.savedId;
    assert.equal(state.albums[0].balance, 400000);
    historicalEntry(withdrawalId, '2026-01-02');
    await api('save_entry', { id: depositId, album_id: albumId, type: 'deposit', amount: 50000, date: '2026-01-01' }, 422);
    await api('delete_entry', { id: depositId }, 422);
    state = await api();
    assert.equal(state.albums[0].balance, 400000, 'Transaksi gagal tidak mengubah saldo');
    assert.equal(state.entries.length, 2);
    state = await api('save_entry', { id: withdrawalId, album_id: albumId, type: 'withdrawal', amount: 200000, date: '2200-01-01', note: 'Revisi penarikan' });
    assert.equal(state.albums[0].balance, 300000);
    assert.equal(state.entries.find(entry => entry.id === withdrawalId).date, '2026-01-02', 'Mengedit catatan lama mempertahankan tanggal aslinya');
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
    assert.equal(state.albums[0].plan, null, 'Rencana album lain tidak ikut pindah');
    await api('delete_album', { id: albumId }, 404);
    state = await api('delete_album', { id: secondId });
    assert.equal(state.albums.length, 0);
    assert.equal(state.entries.length, 0);
    assert.doesNotMatch(serverLog, /PHP (?:Warning|Fatal|Parse|Notice)/);
    console.log(`Lulus ${checks} pemeriksaan API: CRUD, rencana menabung, pengaturan perangkat, persistensi, gambar, saldo, CSRF, dan file privat.`);
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

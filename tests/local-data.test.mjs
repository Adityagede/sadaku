import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { changeWallet, emptyWallet, validateWallet, walletSnapshot, wibTime } from '../assets/js/domain/wallet.js';
import { createLocalStore, validatePhoto } from '../assets/js/data/local-store.js';
import { encodeBackup, decodeBackup, MAX_BACKUP_BYTES } from '../assets/js/data/backup.js';
import { createDataSource } from '../assets/js/data/data-source.js';

const albumId = 'a'.repeat(24);
const secondAlbumId = 'b'.repeat(24);
const entryId = '1'.repeat(24);
const at = new Date('2026-11-30T16:59:59.000Z');
const form = values => { const body = new FormData(); for (const [key, value] of Object.entries(values)) body.set(key, value); return body; };
const albumForm = values => form({ name: 'Sepeda', target: '1000000', motivation: '', color: 'sage', deadline: '', plan_enabled: '0', ...values });
const entryForm = values => form({ album_id: albumId, type: 'deposit', amount: '50000', note: '', ...values });
const albumState = () => changeWallet(emptyWallet(), 'save_album', albumForm(), { id: albumId, now: at }).state;
const depositState = () => changeWallet(albumState(), 'save_entry', entryForm(), { id: entryId, now: at }).state;
const png = () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII='), c => c.charCodeAt(0))], { type: 'image/png' });
const backupFile = value => new Blob([typeof value === 'string' ? value : JSON.stringify(value)], { type: 'application/json' });
function local(t, options = {}) {
    const repository = createLocalStore({ indexedDB: new IDBFactory(), ...options });
    t.after(() => repository.close());
    return repository;
}
function dataSource(t, options = {}) {
    const source = createDataSource({ indexedDB: new IDBFactory(), storage: { getItem: () => null, setItem() {} }, serverRequest: async () => { throw new Error('Server harus tidak dipanggil.'); }, ...options });
    t.after(() => source.close());
    return source;
}

test('Wallet kosong tidak mengandung data contoh; saldo selalu dihitung dari catatan', () => {
    const snapshot = walletSnapshot(depositState());
    assert.equal(snapshot.albums[0].balance, 50000);
    assert.equal(snapshot.albums[0].entryCount, 1);
    assert.deepEqual(emptyWallet().albums, []);
    assert.equal('csrf' in snapshot, false);
});

test('Tanggal catatan baru mengikuti waktu simpan WIB, melewati tengah malam', () => {
    assert.equal(wibTime(at).slice(0, 10), '2026-11-30');
    const state = changeWallet(albumState(), 'save_entry', entryForm({ date: '2000-01-01' }), { id: entryId, now: new Date('2026-11-30T17:00:00Z') }).state;
    assert.equal(state.entries[0].date, '2026-12-01');
});

test('Edit catatan mempertahankan tanggal dan album, termasuk catatan historis', () => {
    const original = depositState();
    original.entries[0].date = '2025-01-01';
    const result = changeWallet(original, 'save_entry', entryForm({ id: entryId, amount: '60000', date: '2026-12-01' }), { now: at }).state;
    assert.equal(result.entries[0].date, '2025-01-01');
    assert.equal(result.entries[0].createdAt, original.entries[0].createdAt);
    const two = changeWallet(original, 'save_album', albumForm({ name: 'Lain' }), { id: secondAlbumId, now: at }).state;
    assert.throws(() => changeWallet(two, 'save_entry', entryForm({ id: entryId, album_id: secondAlbumId })), /tidak dapat dipindahkan/);
});

test('Penarikan, perubahan setoran, dan penghapusan ditolak jika saldo historis negatif', () => {
    const deposited = depositState();
    const withdrawal = changeWallet(deposited, 'save_entry', entryForm({ type: 'withdrawal', amount: '40000' }), { id: '2'.repeat(24), now: at }).state;
    assert.equal(walletSnapshot(withdrawal).albums[0].balance, 10000);
    assert.throws(() => changeWallet(withdrawal, 'delete_entry', form({ id: entryId })), /saldo negatif/);
    assert.throws(() => changeWallet(withdrawal, 'save_entry', entryForm({ id: entryId, amount: '30000' })), /saldo negatif/);
    assert.throws(() => changeWallet(deposited, 'save_entry', entryForm({ type: 'withdrawal', amount: '50001' })), /saldo negatif/);
    assert.equal(walletSnapshot(deposited).albums[0].balance, 50000);
});

test('Catatan dalam milidetik yang sama tetap terurut saat ID penarikan lebih kecil', () => {
    const initial = changeWallet(albumState(), 'save_entry', entryForm(), { id: 'f'.repeat(24), now: at }).state;
    const result = changeWallet(initial, 'save_entry', entryForm({ type: 'withdrawal', amount: '50000' }), { id: '0'.repeat(24), now: at }).state;
    assert.equal(walletSnapshot(result).albums[0].balance, 0);
    assert.ok(result.entries[1].createdAt > result.entries[0].createdAt);
});

test('Rencana disimpan bersama album dan data tidak berubah ketika rencana tidak valid', () => {
    const values = { plan_enabled: '1', plan_frequency: 'weekly', plan_amount: '5000', plan_start_date: '2026-11-01', plan_schedule_day: '0', plan_reminder_enabled: '1', plan_reminder_time: '19:00', plan_paused: '0' };
    const state = changeWallet(emptyWallet(), 'save_album', albumForm(values), { id: albumId, now: at }).state;
    assert.equal(state.albums[0].plan.scheduleDay, 0);
    assert.equal(state.albums[0].plan.reminderEnabled, true);
    assert.equal(walletSnapshot(state).albums[0].balance, 0);
    const original = emptyWallet();
    assert.throws(() => changeWallet(original, 'save_album', albumForm({ ...values, plan_reminder_time: '24:00' })), /Jam/);
    assert.deepEqual(original, emptyWallet());
});

test('Nominal, tanggal, ID, dan hubungan data dalam cadangan divalidasi', () => {
    for (const amount of ['0', '-1', '1.5', '1000000000001', 'NaN']) assert.throws(() => changeWallet(albumState(), 'save_entry', entryForm({ amount })));
    for (const deadline of ['2026-02-30', '1899-12-31', '2201-01-01']) assert.throws(() => changeWallet(emptyWallet(), 'save_album', albumForm({ deadline })));
    const base = depositState();
    assert.throws(() => validateWallet({ ...base, entries: [...base.entries, ...base.entries] }), /berulang/);
    assert.throws(() => validateWallet({ ...base, entries: [{ ...base.entries[0], albumId: secondAlbumId }] }), /tujuan/);
    assert.throws(() => validateWallet({ ...base, version: 99 }), /Versi/);
});

test('Menghapus album ikut menghapus catatan dan rencana yang terkait', () => {
    const result = changeWallet(depositState(), 'delete_album', form({ id: albumId })).state;
    assert.deepEqual(result.albums, []);
    assert.deepEqual(result.entries, []);
});

test('IndexedDB menyimpan data melampaui penutupan repository', async t => {
    const indexedDB = new IDBFactory();
    const first = local(t, { indexedDB });
    const result = await first.request('save_album', albumForm());
    await first.close();
    const second = local(t, { indexedDB });
    assert.equal((await second.request()).albums[0].id, result.savedId);
});

test('Foto disimpan sebagai Blob di IndexedDB dan penghapusannya tidak menyisakan versi foto', async t => {
    const repository = local(t);
    const body = albumForm();
    body.set('image', png(), 'cover.png');
    const created = await repository.request('save_album', body);
    assert.match(created.albums[0].imageUrl, /^blob:/);
    assert.deepEqual(await (await repository.read()).albums[0].image.arrayBuffer(), await png().arrayBuffer());
    const edited = await repository.request('save_album', albumForm({ id: created.savedId, remove_image: '1' }));
    assert.equal(edited.albums[0].imageVersion, null);
    assert.equal((await repository.read()).albums[0].image, null);
});

test('Transaksi dari dua tab tidak saling menimpa dan hanya satu penarikan melebihi saldo yang berhasil', async t => {
    const indexedDB = new IDBFactory();
    const first = local(t, { indexedDB }), second = local(t, { indexedDB });
    const created = await first.request('save_album', albumForm());
    const id = created.savedId;
    await Promise.all([first.request('save_entry', entryForm({ album_id: id })), second.request('save_entry', entryForm({ album_id: id }))]);
    assert.equal((await first.request()).albums[0].balance, 100000);
    const withdrawals = await Promise.allSettled([first.request('save_entry', entryForm({ album_id: id, type: 'withdrawal', amount: '75000' })), second.request('save_entry', entryForm({ album_id: id, type: 'withdrawal', amount: '75000' }))]);
    assert.equal(withdrawals.filter(value => value.status === 'fulfilled').length, 1);
    assert.equal((await second.request()).albums[0].balance, 25000);
});

test('Kegagalan transaksi tidak menghapus data dan tidak mengirim pemberitahuan sukses', async t => {
    const changes = [];
    const repository = local(t, { changed: revision => changes.push(revision) });
    const result = await repository.request('save_album', albumForm());
    await assert.rejects(repository.request('save_entry', entryForm({ album_id: result.savedId, type: 'withdrawal' })), /saldo negatif/);
    assert.equal((await repository.request()).entries.length, 0);
    assert.equal(changes.length, 1);
});

test('IndexedDB yang tidak tersedia tidak berpindah diam-diam ke memori atau server', async t => {
    const repository = local(t, { indexedDB: null });
    await assert.rejects(repository.request(), /Penyimpanan browser/);
});

test('Kegagalan kuota membatalkan transaksi dan menjelaskan bahwa perubahan belum disimpan', async t => {
    const repository = local(t);
    await repository.request('save_album', albumForm());
    const put = IDBObjectStore.prototype.put;
    try {
        IDBObjectStore.prototype.put = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
        await assert.rejects(repository.request('save_album', albumForm({ name: 'Gagal' })), /perangkat penuh.*belum tersimpan/);
    } finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await repository.request()).albums.length, 1);
});

test('Wallet dengan versi tak didukung tidak dihapus atau ditimpa saat dibuka', async t => {
    const indexedDB = new IDBFactory();
    const repository = local(t, { indexedDB });
    await repository.request();
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sadaku-local-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
        await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put({ version: 99, important: 'preserve' }, 'wallet'); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
        await assert.rejects(repository.request(), /Versi.*tidak dihapus/);
        const stored = await new Promise(resolve => { const request = db.transaction('state').objectStore('state').get('wallet'); request.onsuccess = () => resolve(request.result); });
        assert.deepEqual(stored, { version: 99, important: 'preserve' });
    } finally { db.close(); }
});

test('Cadangan dan pemulihan mempertahankan foto, rencana, ID, tanggal historis, serta mengabaikan saldo palsu', async () => {
    const state = depositState();
    state.entries[0].date = '2020-02-29';
    state.albums[0].image = png();
    state.albums[0].imageVersion = 'a'.repeat(24);
    state.albums[0].plan = { frequency: 'monthly', amount: 1000, startDate: '2020-01-01', scheduleDay: 31, reminderEnabled: false, reminderTime: '19:00', paused: false };
    const content = await encodeBackup(state);
    const saved = JSON.parse(content);
    saved.albums[0].balance = 999999;
    saved.csrf = 'must-not-import';
    const decoded = await decodeBackup(backupFile(saved));
    assert.deepEqual(decoded.summary, { albums: 1, entries: 1, photos: 1 });
    assert.equal(decoded.state.entries[0].date, '2020-02-29');
    assert.deepEqual(decoded.state.albums[0].plan, state.albums[0].plan);
    assert.deepEqual(await decoded.state.albums[0].image.arrayBuffer(), await state.albums[0].image.arrayBuffer());
    assert.equal(walletSnapshot(decoded.state).albums[0].balance, 50000);
    assert.equal('csrf' in decoded.state, false);
});

test('Cadangan rusak, versi asing, record duplikat, saldo negatif, dan foto palsu ditolak', async () => {
    await assert.rejects(decodeBackup(backupFile('{')), /JSON/);
    const saved = JSON.parse(await encodeBackup(depositState()));
    await assert.rejects(decodeBackup(backupFile({ ...saved, version: 99 })), /versi/);
    await assert.rejects(decodeBackup(backupFile({ ...saved, entries: [...saved.entries, ...saved.entries] })), /berulang/);
    await assert.rejects(decodeBackup(backupFile({ ...saved, entries: [{ ...saved.entries[0], type: 'withdrawal' }] })), /saldo negatif/);
    const badPhoto = { ...saved.albums[0], image: { type: 'image/png', base64: btoa('<script>bad</script>') }, imageVersion: 'a'.repeat(24) };
    await assert.rejects(decodeBackup(backupFile({ ...saved, albums: [badPhoto] })), /Foto|foto/);
    await assert.rejects(decodeBackup(new Blob([new Uint8Array(MAX_BACKUP_BYTES + 1)])), /32 MB/);
});

test('Foto SVG, MIME palsu, dan foto terlalu besar ditolak sebelum transaksi', async () => {
    await assert.rejects(validatePhoto(new Blob(['<svg/>'], { type: 'image/svg+xml' })), /foto/);
    await assert.rejects(validatePhoto(new Blob([await png().arrayBuffer()], { type: 'image/jpeg' })), /foto/);
    await assert.rejects(validatePhoto(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)])), /4 MB/);
});

test('Pemulihan menguji revisi secara atomik dan menolak pratinjau yang sudah kedaluwarsa oleh perubahan data', async t => {
    const source = dataSource(t);
    const created = await source.request('save_album', albumForm());
    const preview = await source.preview(backupFile(await encodeBackup(depositState())));
    await source.request('save_entry', entryForm({ album_id: created.savedId }));
    await assert.rejects(source.restore(preview), /Data berubah/);
    assert.equal((await source.request()).albums[0].id, created.savedId);
    const current = await source.preview(backupFile(await encodeBackup(depositState())));
    const restored = await source.restore(current);
    assert.equal(restored.albums[0].id, albumId);
    assert.equal(restored.albums[0].balance, 50000);
    await assert.rejects(source.restore(current), /Data berubah/);
});

test('Mode perangkat adalah default, tidak menghubungi API, dan tidak mencampur data server', async t => {
    let calls = 0;
    const source = dataSource(t, { serverRequest: async () => { calls++; return { albums: [], entries: [], csrf: 'server-token' }; } });
    assert.equal(source.source(), 'local');
    const localData = await source.request('save_album', albumForm());
    assert.equal(calls, 0);
    assert.equal((await source.select('server')).csrf, 'server-token');
    assert.equal(source.source(), 'server');
    await assert.rejects(source.preview(backupFile(await encodeBackup(emptyWallet()))), /perangkat/);
    const restored = await source.select('local');
    assert.equal(restored.albums[0].id, localData.savedId);
    assert.equal('csrf' in restored, false);
    assert.equal(calls, 1);
});

test('Kegagalan membuka server tidak mengganti preferensi sumber atau data lokal', async t => {
    const choices = [];
    const source = dataSource(t, { storage: { getItem: () => null, setItem: (...value) => choices.push(value) } });
    await source.request('save_album', albumForm());
    await assert.rejects(source.select('server'), /tidak dipanggil/);
    assert.equal(source.source(), 'local');
    assert.equal(choices.length, 0);
    assert.equal((await source.request()).albums.length, 1);
});

test('Cadangan server dapat dipratinjau ke perangkat tanpa menulis atau menghapus data server', async t => {
    const calls = [];
    const server = walletSnapshot(depositState());
    const source = dataSource(t, { serverRequest: async (action, body) => { calls.push({ action, body }); return { ...server, csrf: 'server-secret' }; } });
    const original = await source.request('save_album', albumForm());
    await source.select('server');
    const { content } = await source.backup();
    assert.equal(content.includes('server-secret'), false);
    await source.select('local');
    const preview = await source.preview(backupFile(content));
    assert.equal((await source.request()).albums[0].id, original.savedId);
    await source.restore(preview);
    assert.equal((await source.request()).albums[0].id, albumId);
    assert.equal((await source.request()).albums[0].balance, 50000);
    assert.ok(calls.every(call => call.body === undefined && call.action === undefined));
    assert.equal(server.albums[0].balance, 50000);
});

test('Cadangan server ditolak jika snapshot berubah selama pengambilan foto/data', async t => {
    let requests = 0;
    const server = walletSnapshot(depositState());
    const source = dataSource(t, { serverRequest: async () => {
        requests++;
        return requests < 3 ? server : { ...server, albums: [{ ...server.albums[0], name: 'Sudah diubah' }] };
    } });
    await source.select('server');
    await assert.rejects(source.backup(), /berubah saat cadangan/);
});

test('Cadangan mencatat waktu pembuatan, tanpa memasukkan metadata sesi atau pengingat perangkat', async t => {
    const source = dataSource(t);
    await source.request('save_album', albumForm());
    const backup = await source.backup();
    assert.equal((await source.request()).lastBackupAt, backup.createdAt);
    const saved = JSON.parse(backup.content);
    assert.deepEqual(Object.keys(saved).sort(), ['albums', 'amountUnit', 'createdAt', 'currency', 'entries', 'format', 'timeZone', 'version'].sort());
});

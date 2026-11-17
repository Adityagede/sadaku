import { currencyInfo } from './currency.js';
// Domain rules shared by local persistence and backup validation.
export const WALLET_VERSION = 3;
export const MAX_ALBUMS = 1000;
export const MAX_ENTRIES = 100000;
const MAX_MONEY = 1000000000000;
const MAX_BALANCE = 9000000000000;
const idPattern = /^[a-f0-9]{24}$/;
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

function fail(message) { throw new Error(message); }
function text(value, maximum, required = false) {
    if (typeof value !== 'string') fail('Format teks tidak valid.');
    value = value.trim();
    if ((required && !value) || Array.from(value).length > maximum) fail('Isian kosong atau terlalu panjang.');
    return value;
}
function money(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MONEY) fail('Nominal di luar batas pencatatan.');
    return value;
}
function moneyField(form, key) {
    const value = form.get(key);
    if (typeof value !== 'string' || !/^\d{1,13}$/.test(value)) fail('Format nominal tidak valid.');
    return money(Number(value));
}
export function walletDate(value, optional = false) {
    if (optional && (value === null || value === '')) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || value < '1900-01-01' || value > '2200-12-31') fail('Tanggal harus valid, antara tahun 1900 dan 2200.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('Tanggal tidak valid.');
    return value;
}
function timestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} [0-2]\d:[0-5]\d:[0-5]\d(?:\.\d{1,6})?$/.test(value) || Number(value.slice(11, 13)) > 23) fail('Waktu pembuatan catatan tidak valid.');
    walletDate(value.slice(0, 10));
    return value.includes('.') ? value.padEnd(26, '0') : `${value}.000000`;
}
export function wibTime(now = new Date()) {
    const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${String(now.getUTCMilliseconds()).padStart(3, '0')}000`;
}
function nextTimestamp(state, now) {
    const current = wibTime(now);
    const latest = [...state.albums, ...state.entries].reduce((last, row) => row.createdAt > last ? row.createdAt : last, '');
    if (current > latest) return current;
    // Keep writes ordered even when the clock has the same millisecond or moves back.
    const microseconds = Number(latest.slice(20, 26)) + 1;
    if (microseconds < 1000000) return `${latest.slice(0, 20)}${String(microseconds).padStart(6, '0')}`;
    const next = new Date(`${latest.slice(0, 19).replace(' ', 'T')}Z`);
    next.setUTCSeconds(next.getUTCSeconds() + 1);
    return `${next.toISOString().slice(0, 19).replace('T', ' ')}.000000`;
}
export function recordId() { return Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join(''); }
function checkedId(id) { if (typeof id !== 'string' || !idPattern.test(id)) fail('ID data tidak valid.'); return id; }
function boolean(value) { if (typeof value !== 'boolean') fail('Pengaturan rencana tidak valid.'); return value; }
function plan(value) {
    if (value === null) return null;
    if (!value || !['daily', 'weekly', 'monthly'].includes(value.frequency)) fail('Jadwal menabung tidak valid.');
    const day = value.scheduleDay;
    if (!Number.isInteger(day) || (value.frequency === 'daily' && day !== 1)
        || (value.frequency === 'weekly' && (day < 0 || day > 6))
        || (value.frequency === 'monthly' && (day < 1 || day > 31))) fail('Hari atau tanggal jadwal tidak valid.');
    if (typeof value.reminderTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.reminderTime)) fail('Jam pengingat tidak valid.');
    return { frequency: value.frequency, amount: money(value.amount), startDate: walletDate(value.startDate), scheduleDay: day,
        reminderEnabled: boolean(value.reminderEnabled), reminderTime: value.reminderTime, paused: boolean(value.paused) };
}
function flag(form, key) {
    const value = form.get(key) ?? '';
    if (!['', '0', '1'].includes(value)) fail('Pengaturan rencana tidak valid.');
    return value === '1';
}
function formPlan(form) {
    const frequency = form.get('plan_frequency');
    const day = form.get('plan_schedule_day');
    if (typeof day !== 'string' || !/^\d{1,2}$/.test(day)) fail('Hari jadwal tidak valid.');
    return plan({ frequency, amount: moneyField(form, 'plan_amount'), startDate: form.get('plan_start_date'),
        scheduleDay: frequency === 'daily' ? 1 : Number(day), reminderEnabled: flag(form, 'plan_reminder_enabled'),
        reminderTime: form.get('plan_reminder_time'), paused: flag(form, 'plan_paused') });
}
export function emptyWallet() { return { version: WALLET_VERSION, revision: 0, currency: 'IDR', currencySelected: false, albums: [], entries: [], lastBackupAt: null }; }
export function validateWallet(input) {
    if (!input || ![1, 2, WALLET_VERSION].includes(input.version) || !Number.isSafeInteger(input.revision) || input.revision < 0) fail('Versi atau struktur penyimpanan tidak didukung. Data lama tidak dihapus.');
    if (!Array.isArray(input.albums) || !Array.isArray(input.entries) || input.albums.length > MAX_ALBUMS || input.entries.length > MAX_ENTRIES) fail('Jumlah album atau catatan melewati batas penyimpanan.');
    const currency = input.version === 1 ? 'IDR' : currencyInfo(input.currency).code;
    const currencySelected = input.version === 1 ? true : input.currencySelected;
    if (typeof currencySelected !== 'boolean') fail('Pengaturan mata uang tidak valid.');
    const ids = new Set();
    const albums = input.albums.map(value => {
        if (!value || typeof value !== 'object') fail('Data album tidak valid.');
        const id = checkedId(value.id);
        if (ids.has(id)) fail('Ada ID album yang berulang.');
        ids.add(id);
        if (!['sage', 'peach', 'lilac', 'sand'].includes(value.color)) fail('Warna album tidak valid.');
        if (value.image != null && (!(value.image instanceof Blob) || value.image.size > 4 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(value.image.type))) fail('Foto album tidak valid.');
        if (value.image && (typeof value.imageVersion !== 'string' || !/^[a-f0-9]{16,32}$/.test(value.imageVersion))) fail('Versi foto tidak valid.');
        const albumCurrency = input.version < 3 ? currency : currencyInfo(value.currency).code;
        return { id, currency: albumCurrency, name: text(value.name, 70, true), target: money(value.target), deadline: walletDate(value.deadline, true),
            motivation: text(value.motivation, 180), color: value.color, createdAt: timestamp(value.createdAt),
            image: value.image || null, imageVersion: value.image ? value.imageVersion : null, plan: plan(value.plan) };
    });
    const entryIds = new Set();
    const entries = input.entries.map(value => {
        if (!value || typeof value !== 'object') fail('Data catatan tidak valid.');
        const id = checkedId(value.id), albumId = checkedId(value.albumId);
        if (entryIds.has(id) || !ids.has(albumId)) fail('Catatan berulang atau album tujuan tidak ditemukan.');
        entryIds.add(id);
        if (!['deposit', 'withdrawal'].includes(value.type)) fail('Jenis catatan tidak valid.');
        return { id, albumId, type: value.type, amount: money(value.amount), date: walletDate(value.date),
            note: text(value.note, 120), createdAt: timestamp(value.createdAt) };
    });
    const balances = new Map();
    for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
        const balance = (balances.get(entry.albumId) || 0) + (entry.type === 'deposit' ? entry.amount : -entry.amount);
        if (balance < 0) fail('Perubahan ini membuat saldo negatif pada riwayat album. Periksa setoran dan penarikannya.');
        if (balance > MAX_BALANCE) fail('Saldo album sudah melewati batas pencatatan.');
        balances.set(entry.albumId, balance);
    }
    if (input.lastBackupAt !== null && (typeof input.lastBackupAt !== 'string' || !Number.isFinite(Date.parse(input.lastBackupAt)))) fail('Metadata cadangan tidak valid.');
    return { version: WALLET_VERSION, revision: input.revision, currency, currencySelected, albums, entries, lastBackupAt: input.lastBackupAt };
}
export function walletSnapshot(input) {
    const state = validateWallet(input);
    const totals = new Map(state.albums.map(album => [album.id, { balance: 0, entryCount: 0 }]));
    for (const entry of state.entries) {
        const total = totals.get(entry.albumId);
        total.balance += entry.type === 'deposit' ? entry.amount : -entry.amount;
        total.entryCount++;
    }
    const descending = (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    return { albums: state.albums.map(album => ({ ...album, ...totals.get(album.id) })).sort(descending),
        entries: [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || descending(a, b)),
        currency: state.currency, currencySelected: state.currencySelected, revision: state.revision, lastBackupAt: state.lastBackupAt, source: 'local', settings: {}, push: { configured: false, local: true } };
}
export function changeWallet(input, action, form, { now = new Date(), id = recordId(), image = undefined } = {}) {
    const state = validateWallet(input);
    const requestedId = form.get('id') || '';
    let savedId;
    if (action === 'set_currency') {
        if (state.albums.length || state.entries.length) fail('Mata uang terkunci karena sudah ada album.');
        state.currency = currencyInfo(form.get('currency')).code;
        state.currencySelected = true;
    } else if (action === 'save_album') {
        state.currencySelected = true;
        const existing = requestedId ? state.albums.find(album => album.id === requestedId) : null;
        if (requestedId && !existing) fail('Album sudah tidak tersedia. Muat ulang halaman.');
        const currency = currencyInfo(form.get('currency') || existing?.currency || state.currency).code;
        if (existing && currency !== existing.currency) fail('Mata uang album yang sudah tersimpan tidak dapat diubah. Buat album baru untuk mata uang lain.');
        if (form.has('plan_enabled') && !['0', '1'].includes(form.get('plan_enabled'))) fail('Pengaturan rencana tidak valid.');
        const selectedImage = image !== undefined ? image : flag(form, 'remove_image') ? null : existing?.image || null;
        savedId = existing?.id || checkedId(id);
        const album = { id: savedId, currency, name: form.get('name'), target: moneyField(form, 'target'), deadline: form.get('deadline') || null,
            motivation: form.get('motivation') || '', color: form.get('color'), createdAt: existing?.createdAt || nextTimestamp(state, now),
            image: selectedImage, imageVersion: selectedImage ? (image !== undefined ? recordId() : existing?.imageVersion) : null,
            plan: form.has('plan_enabled') ? (form.get('plan_enabled') === '1' ? formPlan(form) : null) : existing?.plan || null };
        state.albums = existing ? state.albums.map(value => value.id === savedId ? album : value) : [...state.albums, album];
        state.currency = currency;
    } else if (action === 'save_entry') {
        const existing = requestedId ? state.entries.find(entry => entry.id === requestedId) : null;
        if (requestedId && !existing) fail('Catatan sudah tidak tersedia. Muat ulang halaman.');
        const albumId = form.get('album_id');
        const destination = state.albums.find(album => album.id === albumId);
        if (!destination) fail('Album tujuan tidak ditemukan.');
        if (form.has('currency') && form.get('currency') !== destination.currency) fail('Mata uang catatan harus mengikuti album tujuan. Buka kembali formulir.');
        if (existing && existing.albumId !== albumId) fail('Album catatan tidak dapat dipindahkan saat mengedit.');
        savedId = existing?.id || checkedId(id);
        const entry = { id: savedId, albumId, type: form.get('type'), amount: moneyField(form, 'amount'), note: form.get('note') || '',
            date: existing?.date || wibTime(now).slice(0, 10), createdAt: existing?.createdAt || nextTimestamp(state, now) };
        state.entries = existing ? state.entries.map(value => value.id === savedId ? entry : value) : [...state.entries, entry];
    } else if (action === 'delete_album') {
        if (!state.albums.some(album => album.id === requestedId)) fail('Album sudah tidak ditemukan.');
        state.albums = state.albums.filter(album => album.id !== requestedId);
        state.entries = state.entries.filter(entry => entry.albumId !== requestedId);
    } else if (action === 'delete_entry') {
        if (!state.entries.some(entry => entry.id === requestedId)) fail('Catatan sudah tidak ditemukan.');
        state.entries = state.entries.filter(entry => entry.id !== requestedId);
    } else fail('Permintaan penyimpanan lokal tidak tersedia.');
    state.revision++;
    return { state: validateWallet(state), savedId };
}

import { createLocalStore } from './local-store.js';
import { encodeBackup, decodeBackup, MAX_BACKUP_BYTES } from './backup.js';
import { emptyWallet, validateWallet } from '../domain/wallet.js';

const preferenceKey = 'sadaku.data-source';
export function createDataSource({ serverRequest, changed = () => {}, storage, indexedDB, name, initialSource = null } = {}) {
    let preference;
    try { preference = storage ?? globalThis.localStorage; } catch { /* Local data can still use IndexedDB. */ }
    let mode = 'local';
    try { if (preference?.getItem(preferenceKey) === 'server') mode = 'server'; } catch { /* Use local by default. */ }
    if (initialSource === 'server') {
        mode = 'server';
        try { preference?.setItem(preferenceKey, mode); } catch { /* Notification destination lasts for this tab. */ }
    }
    const local = createLocalStore({ indexedDB, name, changed: revision => { changed(revision); } });
    const source = () => mode;
    async function request(action = 'state', body = null) {
        if (mode === 'server' && body?.has('currency') && body.get('currency') !== 'IDR') throw new Error('Server pribadi menggunakan IDR. Buka kembali formulir pada sumber data yang benar.');
        return mode === 'local' ? local.request(action, body) : { ...await serverRequest(action, body), source: 'server' };
    }
    async function select(nextMode) {
        if (!['local', 'server'].includes(nextMode)) throw new Error('Pilihan penyimpanan tidak valid.');
        // Never persist a failed destination or move any records when switching.
        const result = nextMode === 'local' ? await local.request() : { ...await serverRequest(), source: 'server' };
        mode = nextMode;
        try { preference?.setItem(preferenceKey, mode); } catch { /* Selection lasts for this tab. */ }
        return result;
    }
    async function backup() {
        const currentMode = mode;
        let state;
        if (currentMode === 'local') state = await local.read();
        else {
            const result = await serverRequest();
            const albums = [];
            let imageBytes = 0;
            for (const album of result.albums) {
                let image = null;
                if (album.imageVersion) {
                    const response = await fetch(`php/api.php?action=image&id=${encodeURIComponent(album.id)}&v=${encodeURIComponent(album.imageVersion)}`, { credentials: 'same-origin', cache: 'no-store' });
                    if (!response.ok) throw new Error('Foto server belum dapat dicadangkan. Coba lagi.');
                    image = await response.blob();
                    imageBytes += image.size;
                    if (imageBytes > MAX_BACKUP_BYTES * 3 / 4) throw new Error('Cadangan melewati batas 32 MB. Kurangi ukuran foto sebelum mencoba lagi.');
                }
                albums.push({ ...album, currency: 'IDR', image });
            }
            // A second snapshot detects edits made while pictures were being read.
            const latest = await serverRequest();
            if (JSON.stringify(result.albums) !== JSON.stringify(latest.albums) || JSON.stringify(result.entries) !== JSON.stringify(latest.entries)) throw new Error('Data server berubah saat cadangan dibuat. Coba lagi.');
            state = validateWallet({ ...emptyWallet(), albums, entries: result.entries });
        }
        const createdAt = new Date().toISOString();
        const content = await encodeBackup(state, createdAt);
        if (mode !== currentMode) throw new Error('Pilihan penyimpanan berubah. Buat cadangan kembali.');
        if (currentMode === 'local') await local.markBackup(state.revision, createdAt);
        return { content, createdAt };
    }
    async function preview(file) {
        if (mode !== 'local') throw new Error('Pemulihan tersedia untuk data di perangkat ini. Pilih penyimpanan perangkat terlebih dahulu.');
        const before = await local.read();
        const parsed = await decodeBackup(file);
        return { ...parsed, expectedRevision: before.revision, current: { albums: before.albums.length, entries: before.entries.length } };
    }
    async function restore(preview) {
        if (mode !== 'local') throw new Error('Pilihan penyimpanan berubah. Buka cadangan kembali.');
        return local.replace(preview.state, preview.expectedRevision);
    }
    return { source, request, select, backup, preview, restore, close: local.close };
}

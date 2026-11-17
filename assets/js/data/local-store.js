import { changeWallet, emptyWallet, validateWallet, walletSnapshot } from '../domain/wallet.js';

function storageError(error) {
    return new Error(error?.name === 'QuotaExceededError'
        ? 'Penyimpanan perangkat penuh. Perubahan belum tersimpan. Cadangkan data lalu kosongkan ruang perangkat.'
        : 'Penyimpanan browser tidak dapat digunakan. Izinkan penyimpanan situs atau gunakan browser lain. Data tidak dihapus.');
}

export async function validatePhoto(blob) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > 4 * 1024 * 1024) throw new Error('Ukuran foto maksimal 4 MB.');
    const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    const mime = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff ? 'image/jpeg'
        : [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte) ? 'image/png'
        : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP' ? 'image/webp' : null;
    if (!mime || (blob.type && blob.type !== mime)) throw new Error('Gunakan foto JPG, PNG, atau WebP yang valid.');
    const photo = blob.slice(0, blob.size, mime);
    if (mime === 'image/png' && header.length >= 24) {
        const view = new DataView(header.buffer);
        if (view.getUint32(16) > 12000 || view.getUint32(20) > 12000) throw new Error('Foto maksimal 12.000 piksel per sisi.');
    }
    let width, height;
    if (typeof createImageBitmap === 'function') {
        let bitmap;
        try { bitmap = await createImageBitmap(photo); width = bitmap.width; height = bitmap.height; }
        catch { throw new Error('Foto tidak dapat dibaca. Pilih foto lain.'); }
        finally { bitmap?.close(); }
    } else if (typeof Image === 'function') {
        const url = URL.createObjectURL(photo);
        try {
            const image = new Image();
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
            width = image.naturalWidth; height = image.naturalHeight;
        } catch { throw new Error('Foto tidak dapat dibaca. Pilih foto lain.'); }
        finally { URL.revokeObjectURL(url); }
    } else if (mime === 'image/png' && header.length >= 24) {
        const view = new DataView(header.buffer); width = view.getUint32(16); height = view.getUint32(20);
    } else throw new Error('Validasi foto tidak tersedia pada perangkat ini.');
    if (!width || !height || width > 12000 || height > 12000) throw new Error('Foto maksimal 12.000 piksel per sisi.');
    return photo;
}

export function createLocalStore({ indexedDB = globalThis.indexedDB, name = 'sadaku-local-v1', changed = () => {} } = {}) {
    let connection;
    const imageUrls = new Map();
    async function open() {
        if (!indexedDB) throw storageError();
        if (!connection) connection = new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            let blocked = false;
            request.onupgradeneeded = () => request.result.createObjectStore('state');
            request.onblocked = () => { blocked = true; reject(new Error('Tutup tab Sadaku lain lalu muat ulang untuk membuka penyimpanan.')); };
            request.onerror = () => { connection = null; reject(storageError(request.error)); };
            request.onsuccess = () => {
                const db = request.result;
                if (blocked) { db.close(); connection = null; return; }
                db.onversionchange = () => { db.close(); connection = null; };
                resolve(db);
            };
        });
        return connection;
    }
    async function transaction(mutator = null, expectedRevision = null) {
        const db = await open();
        return new Promise((resolve, reject) => {
            let result, failure;
            let tx;
            try { tx = db.transaction('state', mutator ? 'readwrite' : 'readonly'); }
            catch (error) { reject(storageError(error)); return; }
            tx.onabort = () => reject(failure || storageError(tx.error));
            tx.onerror = () => { /* onabort reports the final transaction outcome. */ };
            tx.oncomplete = () => {
                resolve(result);
                if (mutator) { try { changed(result.state.revision); } catch { /* A committed write does not depend on tab notifications. */ } }
            };
            const store = tx.objectStore('state');
            const request = store.get('wallet');
            request.onsuccess = () => {
                try {
                    const state = validateWallet(request.result ?? emptyWallet());
                    if (expectedRevision !== null && state.revision !== expectedRevision) throw new Error('Data berubah sejak pratinjau dibuat. Buka dan periksa cadangan kembali.');
                    result = mutator ? mutator(state) : { state };
                    if (mutator) { result.state = validateWallet(result.state); store.put(result.state, 'wallet'); }
                } catch (error) {
                    failure = ['QuotaExceededError', 'DataCloneError', 'InvalidStateError', 'UnknownError'].includes(error.name) ? storageError(error) : error;
                    tx.abort();
                }
            };
        });
    }
    function snapshot(state) {
        const result = walletSnapshot(state);
        const active = new Set();
        result.albums = result.albums.map(({ image, ...album }) => {
            if (!image) return album;
            const key = `${album.id}:${album.imageVersion}`;
            active.add(key);
            if (!imageUrls.has(key)) imageUrls.set(key, URL.createObjectURL(image));
            return { ...album, imageUrl: imageUrls.get(key) };
        });
        for (const [key, url] of imageUrls) if (!active.has(key)) { URL.revokeObjectURL(url); imageUrls.delete(key); }
        return result;
    }
    async function request(action = 'state', body = null) {
        if (action === 'state') return snapshot((await transaction()).state);
        let image;
        const file = body?.get('image');
        if (action === 'save_album' && file instanceof Blob && file.size) image = await validatePhoto(file);
        const result = await transaction(state => changeWallet(state, action, body, { image }));
        return { ...snapshot(result.state), savedId: result.savedId };
    }
    async function replace(wallet, expectedRevision) {
        const result = await transaction(state => ({ state: { ...validateWallet(wallet), revision: state.revision + 1, lastBackupAt: null } }), expectedRevision);
        return snapshot(result.state);
    }
    async function markBackup(expectedRevision, createdAt) {
        await transaction(state => ({ state: { ...state, revision: state.revision + 1, lastBackupAt: createdAt } }), expectedRevision);
    }
    async function close() {
        if (connection) (await connection).close();
        connection = null;
        for (const url of imageUrls.values()) URL.revokeObjectURL(url);
        imageUrls.clear();
    }
    return { request, read: async () => (await transaction()).state, replace, markBackup, close };
}

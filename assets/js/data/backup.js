import { currencyInfo } from '../domain/currency.js';
import { emptyWallet, validateWallet } from '../domain/wallet.js';
import { validatePhoto } from './local-store.js';

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
const format = 'sadaku-backup';
function encode(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return btoa(binary);
}
export async function encodeBackup(wallet, createdAt = new Date().toISOString()) {
    const state = validateWallet(wallet);
    if (state.albums.reduce((total, album) => total + (album.image?.size || 0), 0) > MAX_BACKUP_BYTES * 3 / 4) throw new Error('Cadangan melewati batas 32 MB. Kurangi ukuran foto sebelum mencoba lagi.');
    const albums = [];
    for (const { image, ...album } of state.albums) {
        albums.push({ ...album, fractionDigits: currencyInfo(album.currency).digits, image: image ? { type: image.type, base64: encode(new Uint8Array(await image.arrayBuffer())) } : null });
    }
    const content = JSON.stringify({ format, version: 3, currency: state.currency, amountUnit: 'integer', timeZone: 'Asia/Jakarta', createdAt, albums, entries: state.entries });
    if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('Cadangan melewati batas 32 MB. Kurangi ukuran foto sebelum mencoba lagi.');
    return content;
}
export async function decodeBackup(file) {
    if (!(file instanceof Blob) || !file.size || file.size > MAX_BACKUP_BYTES) throw new Error('Pilih cadangan Sadaku berukuran maksimal 32 MB.');
    let input;
    try { input = JSON.parse(await file.text()); }
    catch { throw new Error('Berkas cadangan bukan JSON yang dapat dibaca.'); }
    if (!input || input.format !== format || ![1, 2, 3].includes(input.version) || (input.version === 1 && input.currency !== 'IDR') || input.timeZone !== 'Asia/Jakarta'
        || !Array.isArray(input.albums) || !Array.isArray(input.entries) || typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt))) {
        throw new Error('Format atau versi cadangan tidak didukung. Data saat ini tidak diubah.');
    }
    const currency = currencyInfo(input.currency);
    if (input.version === 2 && (input.amountUnit !== 'integer' || input.fractionDigits !== currency.digits)) throw new Error('Satuan nominal cadangan tidak valid.');
    if (input.version === 3 && input.amountUnit !== 'integer') throw new Error('Satuan nominal cadangan tidak valid.');
    // Bound record counts before decoding images or validating the full history.
    if (input.albums.length > 1000 || input.entries.length > 100000) throw new Error('Jumlah data dalam cadangan melewati batas.');
    const albums = [];
    for (const value of input.albums) {
        if (!value || typeof value !== 'object') throw new Error('Album dalam cadangan tidak valid.');
        const albumCurrency = input.version < 3 ? input.currency : currencyInfo(value.currency).code;
        if (input.version === 3 && value.fractionDigits !== currencyInfo(albumCurrency).digits) throw new Error('Satuan nominal album dalam cadangan tidak valid.');
        let image = null;
        if (value.image !== null) {
            const saved = value.image;
            if (!saved || typeof saved.base64 !== 'string' || saved.base64.length > 5592408
                || saved.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(saved.base64)
                || !['image/png', 'image/jpeg', 'image/webp'].includes(saved.type)) throw new Error('Foto dalam cadangan tidak valid.');
            let bytes;
            try { bytes = Uint8Array.from(atob(saved.base64), character => character.charCodeAt(0)); }
            catch { throw new Error('Foto dalam cadangan tidak valid.'); }
            image = await validatePhoto(new Blob([bytes], { type: saved.type }));
        }
        albums.push({ ...value, currency: albumCurrency, image });
    }
    const state = validateWallet({ ...emptyWallet(), currency: input.currency, currencySelected: true, albums, entries: input.entries });
    const photos = state.albums.filter(album => album.image).length;
    return { state, createdAt: input.createdAt, summary: { albums: state.albums.length, entries: state.entries.length, photos } };
}

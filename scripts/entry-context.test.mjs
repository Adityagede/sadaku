import test from 'node:test';
import assert from 'node:assert/strict';
import { entryDestination } from '../assets/js/entry-context.js';
const albums = [{ id: 'iphone' }, { id: 'motor' }];

test('Mencatat dari dalam album mengunci album yang dibuka', () => {
    assert.deepEqual(entryDestination(albums, { viewedAlbumId: 'iphone' }), { albumId: 'iphone', locked: true });
    assert.deepEqual(entryDestination(albums, { albumId: 'motor', filteredAlbumId: 'iphone' }), { albumId: 'motor', locked: true });
});
test('Mengedit dari Riwayat tetap mengunci album catatan asli', () => {
    assert.deepEqual(entryDestination(albums, { entry: { albumId: 'iphone' }, viewedAlbumId: 'motor' }), { albumId: 'iphone', locked: true });
});
test('Pilihan album hanya dibutuhkan saat mencatat global dengan beberapa album', () => {
    assert.deepEqual(entryDestination(albums), { albumId: 'iphone', locked: false });
    assert.deepEqual(entryDestination(albums, { filteredAlbumId: 'motor' }), { albumId: 'motor', locked: false });
    assert.deepEqual(entryDestination([albums[0]]), { albumId: 'iphone', locked: true });
});
test('Album konteks yang sudah hilang tidak diam-diam berpindah ke album lain', () => {
    assert.throws(() => entryDestination(albums, { viewedAlbumId: 'deleted' }), /tidak tersedia/);
    assert.throws(() => entryDestination(albums, { entry: { albumId: 'deleted' } }), /tidak tersedia/);
});

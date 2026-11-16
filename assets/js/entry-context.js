export function entryDestination(albums, { entry = null, albumId = null, viewedAlbumId = null, filteredAlbumId = 'all' } = {}) {
    const fixedId = entry?.albumId || albumId || viewedAlbumId || (albums.length === 1 ? albums[0].id : null);
    if (fixedId) {
        if (!albums.some(album => album.id === fixedId)) throw new Error('Album sudah tidak tersedia. Muat ulang halaman.');
        return { albumId: fixedId, locked: true };
    }
    return { albumId: albums.find(album => album.id === filteredAlbumId)?.id || albums[0]?.id || '', locked: false };
}

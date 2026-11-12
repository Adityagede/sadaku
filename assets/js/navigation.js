const routes = { overview: 'ringkasan', albums: 'album', history: 'riwayat', statistics: 'statistik' };

export function createNavigationState() {
    return {
        view: 'overview',
        albumId: null,
        filter: 'all',
        search: '',
        statistics: { period: 'current', albumId: 'all' },
        history: { period: 'current', albumId: 'all' },
        detailPeriod: 'current'
    };
}

export function parseRoute(hash) {
    const route = hash.replace(/^#/, '');
    if (route.startsWith('album/')) return { view: 'detail', albumId: route.slice(6) };
    const view = Object.keys(routes).find(key => routes[key] === route) || 'overview';
    return { view, albumId: null };
}

export function routeFor(view, albumId = null) {
    return view === 'detail' ? `album/${albumId}` : routes[view] || routes.overview;
}

export function copyStatisticsToHistory(state) {
    // Salin nilai, agar perubahan filter di Riwayat tidak ikut mengubah Statistik.
    state.history = { ...state.statistics };
}

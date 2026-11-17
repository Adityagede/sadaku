import { DEFAULT_ACTIVITY_FILTERS } from '../domain/activity.js';

const routes = { overview: 'ringkasan', albums: 'album', history: 'riwayat', statistics: 'statistik', settings: 'pengaturan', backup: 'cadangan' };

export function isSettingsView(view) {
    return view === 'settings' || view === 'backup';
}

export function createNavigationState() {
    return {
        view: 'overview',
        albumId: null,
        filter: 'all',
        search: '',
        statistics: { period: 'current', albumId: 'all' },
        history: { ...DEFAULT_ACTIVITY_FILTERS },
        historyLimit: 30,
        detailLimit: 30,
        settingsReturn: { view: 'overview', albumId: null }
    };
}

export function applyRoute(state, route) {
    const fromSettings = isSettingsView(state.view);
    const previous = fromSettings ? state.settingsReturn : { view: state.view, albumId: state.albumId };
    if (isSettingsView(route.view) && !fromSettings) state.settingsReturn = previous;
    if (route.view === 'detail' && route.albumId !== previous.albumId) state.detailLimit = 30;
    Object.assign(state, route);
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

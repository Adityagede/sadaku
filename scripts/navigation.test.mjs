import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRoute, createNavigationState, parseRoute, routeFor } from '../assets/js/navigation.js';

test('Statistik dan Riwayat dimulai dengan cakupan masing-masing', () => {
    const state = createNavigationState();
    assert.deepEqual(state.statistics, { period: 'current', albumId: 'all' });
    assert.equal(state.historyLimit, 30);
    assert.deepEqual(state.history, { query: '', month: 'all', albumId: 'all', type: 'all' });
});

test('mengubah periode atau album Statistik tidak membatasi Riwayat maupun detail', () => {
    const state = createNavigationState();
    state.statistics.period = '2026-10';
    state.statistics.albumId = 'iphone';
    assert.equal(state.historyLimit, 30);
    assert.deepEqual(state.history, { query: '', month: 'all', albumId: 'all', type: 'all' });
    assert.equal(state.detailLimit, 30);
});

test('berpindah menu mempertahankan aktivitas lama yang sudah dimuat dan filter Statistik', () => {
    const state = createNavigationState();
    state.historyLimit = 90;
    state.history.query = 'kamera';
    Object.assign(state, parseRoute('#statistik'));
    state.statistics.period = '2026-10';
    Object.assign(state, parseRoute('#riwayat'));
    assert.equal(state.view, 'history');
    assert.equal(state.historyLimit, 90);
    assert.equal(state.history.query, 'kamera');
    assert.equal(state.statistics.period, '2026-10');
});

test('tautan empat menu dan detail album dapat dibuka langsung', () => {
    for (const view of ['overview', 'albums', 'history', 'statistics', 'settings']) {
        assert.equal(parseRoute('#' + routeFor(view)).view, view);
    }
    assert.deepEqual(parseRoute('#album/abc123'), { view: 'detail', albumId: 'abc123' });
    assert.equal(parseRoute('#tidak-ada').view, 'overview');
});

test('Pengaturan kembali ke album yang sama tanpa menghilangkan aktivitas yang telah dimuat', () => {
    const state = createNavigationState();
    applyRoute(state, parseRoute('#album/iphone'));
    state.detailLimit = 90;
    applyRoute(state, parseRoute('#pengaturan'));
    applyRoute(state, parseRoute('#pengaturan'));
    assert.deepEqual(state.settingsReturn, { view: 'detail', albumId: 'iphone' });
    applyRoute(state, state.settingsReturn);
    assert.equal(state.view, 'detail');
    assert.equal(state.albumId, 'iphone');
    assert.equal(state.detailLimit, 90);
    applyRoute(state, parseRoute('#album/motor'));
    assert.equal(state.detailLimit, 30);
});

test('tautan langsung Pengaturan memiliki tujuan kembali dan mempertahankan filter menu lain', () => {
    const state = createNavigationState();
    applyRoute(state, parseRoute('#pengaturan'));
    assert.deepEqual(state.settingsReturn, { view: 'overview', albumId: null });
    applyRoute(state, parseRoute('#statistik'));
    state.statistics.period = '2026-10';
    applyRoute(state, parseRoute('#pengaturan'));
    applyRoute(state, state.settingsReturn);
    assert.equal(state.view, 'statistics');
    assert.equal(state.statistics.period, '2026-10');
});

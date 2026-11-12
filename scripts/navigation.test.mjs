import assert from 'node:assert/strict';
import test from 'node:test';
import { copyStatisticsToHistory, createNavigationState, parseRoute, routeFor } from '../assets/js/navigation.js';

test('Statistik dan Riwayat dimulai pada bulan ini dengan filter masing-masing', () => {
    const state = createNavigationState();
    assert.deepEqual(state.statistics, { period: 'current', albumId: 'all' });
    assert.deepEqual(state.history, { period: 'current', albumId: 'all' });
    assert.notEqual(state.statistics, state.history);
});

test('mengubah periode atau album Statistik tidak mengubah Riwayat maupun detail', () => {
    const state = createNavigationState();
    state.statistics.period = '2026-10';
    state.statistics.albumId = 'iphone';
    assert.deepEqual(state.history, { period: 'current', albumId: 'all' });
    assert.equal(state.detailPeriod, 'current');
});

test('tombol lihat catatan menyalin periode dan album secara sengaja', () => {
    const state = createNavigationState();
    state.statistics = { period: '2026-10', albumId: 'motor' };
    copyStatisticsToHistory(state);
    assert.deepEqual(state.history, state.statistics);
    state.history.period = '2026-09';
    state.history.albumId = 'all';
    assert.deepEqual(state.statistics, { period: '2026-10', albumId: 'motor' });
});

test('berpindah menu mempertahankan pilihan filter selama aplikasi dibuka', () => {
    const state = createNavigationState();
    state.history.period = '2026-09';
    Object.assign(state, parseRoute('#statistik'));
    state.statistics.period = '2026-10';
    Object.assign(state, parseRoute('#riwayat'));
    assert.equal(state.view, 'history');
    assert.equal(state.history.period, '2026-09');
    assert.equal(state.statistics.period, '2026-10');
});

test('tautan empat menu dan detail album dapat dibuka langsung', () => {
    for (const view of ['overview', 'albums', 'history', 'statistics']) {
        assert.equal(parseRoute('#' + routeFor(view)).view, view);
    }
    assert.deepEqual(parseRoute('#album/abc123'), { view: 'detail', albumId: 'abc123' });
    assert.equal(parseRoute('#tidak-ada').view, 'overview');
});

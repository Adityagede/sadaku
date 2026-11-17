import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { currencies, setCurrency, decimalAmount, moneyDisplay } from '../assets/js/domain/currency.js';
import { rawMoney, setMoneyValue } from '../assets/js/components/money-input.js';
import { emptyWallet, validateWallet, changeWallet, walletSnapshot } from '../assets/js/domain/wallet.js';
import { createLocalStore } from '../assets/js/data/local-store.js';
import { encodeBackup, decodeBackup } from '../assets/js/data/backup.js';
import { activityCsv } from '../assets/js/domain/activity.js';
import { suggestedAmount } from '../assets/js/domain/saving-plan.js';
import { createMonthlyReport } from '../assets/js/domain/monthly.js';
import { renderMonthlyReport } from '../assets/js/pages/statistics-view.js';

const form = values => { const body = new FormData(); for (const [key, value] of Object.entries(values)) body.set(key, value); return body; };
const album = { name: 'Laptop', target: '100001', color: 'sage', plan_enabled: '0' };
const id = 'a'.repeat(24);
const selected = code => changeWallet(emptyWallet(), 'set_currency', form({ currency: code })).state;

test('Pecahan setiap mata uang disimpan tepat dan input ambigu ditolak', t => {
    t.after(() => setCurrency('IDR'));
    for (const item of currencies) {
        setCurrency(item.code);
        const text = item.digits ? '1250.50' : item.code === 'IDR' ? '1.250' : '1250';
        assert.equal(rawMoney(text), item.digits ? '125050' : '1250');
        assert.equal(rawMoney('1e3'), null);
        assert.equal(rawMoney('-1'), null);
        assert.equal(rawMoney('1,25'), null);
        const input = { setCustomValidity(message) { this.error = message; } };
        setMoneyValue(input, item.digits ? 125050 : 1250);
        assert.equal(rawMoney(input.value), item.digits ? '125050' : '1250');
        assert.equal(input.error, '');
    }
    setCurrency('USD');
    assert.equal(rawMoney('0.01'), '1');
    assert.equal(rawMoney('12.5'), '1250');
    assert.equal(rawMoney('1.234'), null);
    assert.equal(rawMoney('1.250,50'), null);
    assert.equal(decimalAmount(123), '1.23');
    assert.equal(decimalAmount(-1), '-0.01');
    assert.match(moneyDisplay.format(123), /USD\s*1\.23/);
    assert.match(moneyDisplay.format(8999999999999999), /89,999,999,999,999\.99/);
});

test('Saran rencana membulatkan ke sen dan grafik mempertahankan setoran satu sen', t => {
    t.after(() => setCurrency('IDR'));
    setCurrency('USD');
    const plan = { frequency: 'daily', startDate: '2026-11-01', scheduleDay: 1 };
    assert.equal(suggestedAmount(plan, 100, '2026-11-03', '2026-11-01'), 34);
    const report = createMonthlyReport([{ id: '1', albumId: id, date: '2026-11-01', type: 'deposit', amount: 1 }], 'current', '2026-12-01');
    const markup = renderMonthlyReport(report);
    assert.match(markup, /USD\s*0\.01/);
    assert.match(markup, /report-bar-value[^>]*>0,01</);
});

test('Wallet dan cadangan versi lama tetap Rupiah tanpa mengalikan nominal', async () => {
    const original = changeWallet(emptyWallet(), 'save_album', form(album), { id }).state;
    const legacy = { ...original, version: 1 };
    delete legacy.currency;
    delete legacy.currencySelected;
    const upgraded = validateWallet(legacy);
    assert.equal(upgraded.currency, 'IDR');
    assert.equal(upgraded.albums[0].target, 100001);
    const backup = JSON.parse(await encodeBackup(upgraded));
    backup.version = 1;
    delete backup.amountUnit;
    delete backup.fractionDigits;
    const restored = await decodeBackup(new Blob([JSON.stringify(backup)]));
    assert.equal(restored.state.currency, 'IDR');
    assert.equal(restored.state.albums[0].target, 100001);
});

test('Setiap album memilih mata uang dan catatan wajib mengikuti album tujuan', () => {
    const state = changeWallet(emptyWallet(), 'save_album', form({ ...album, currency: 'USD' }), { id }).state;
    const mixed = changeWallet(state, 'save_album', form({ ...album, currency: 'IDR' }), { id: 'b'.repeat(24) }).state;
    assert.deepEqual(mixed.albums.map(item => item.currency), ['USD', 'IDR']);
    assert.throws(() => changeWallet(mixed, 'save_album', form({ ...album, id, currency: 'EUR' })), /tidak dapat diubah/);
    assert.throws(() => changeWallet(mixed, 'save_entry', form({ album_id: id, type: 'deposit', amount: '100', currency: 'IDR' })), /mengikuti album/);
    assert.throws(() => changeWallet(state, 'save_album', form({ ...album, currency: 'XXX' })), /tidak didukung/);
});

test('Sen dihitung tepat, saldo negatif ditolak dan CSV memakai nominal utama', t => {
    t.after(() => setCurrency('IDR'));
    let state = changeWallet(selected('EUR'), 'save_album', form(album), { id }).state;
    for (const amount of ['10', '20']) state = changeWallet(state, 'save_entry', form({ album_id: id, type: 'deposit', amount })).state;
    assert.equal(walletSnapshot(state).albums[0].balance, 30);
    assert.throws(() => changeWallet(state, 'save_entry', form({ album_id: id, type: 'withdrawal', amount: '31' })), /negatif/);
    setCurrency('EUR');
    const csv = activityCsv(state.entries, state.albums);
    assert.match(csv, /Nominal \(EUR\)/);
    assert.match(csv, /,0\.10,/);
    assert.match(csv, /,0\.20,/);
});

test('Pilihan persisten, cadangan mempertahankan sen, dan skala palsu ditolak', async t => {
    const indexedDB = new IDBFactory();
    const store = createLocalStore({ indexedDB });
    t.after(() => store.close());
    await store.request('set_currency', form({ currency: 'USD' }));
    await store.request('save_album', form({ ...album, currency: 'USD' }));
    await store.close();
    const state = await store.read();
    assert.equal(state.currency, 'USD');
    assert.equal(state.albums[0].target, 100001);
    const backup = JSON.parse(await encodeBackup(state));
    const restored = await decodeBackup(new Blob([JSON.stringify(backup)]));
    assert.equal(restored.state.currency, 'USD');
    assert.equal(restored.state.albums[0].target, 100001);
    backup.albums[0].fractionDigits = 0;
    await assert.rejects(decodeBackup(new Blob([JSON.stringify(backup)])), /Satuan/);
});

test('Pembuatan album berbeda mata uang dari dua tab tidak saling menimpa', async t => {
    const indexedDB = new IDBFactory();
    const first = createLocalStore({ indexedDB }), second = createLocalStore({ indexedDB });
    t.after(async () => { await first.close(); await second.close(); });
    await Promise.all([
        first.request('save_album', form({ ...album, currency: 'EUR' })),
        second.request('save_album', form({ ...album, currency: 'USD' })),
    ]);
    const state = await first.read();
    assert.equal(state.albums.length, 2);
    assert.deepEqual(state.albums.map(item => item.currency).sort(), ['EUR', 'USD']);
});

test('Cadangan campuran dan CSV mempertahankan satuan setiap album', async () => {
    let state = changeWallet(emptyWallet(), 'save_album', form({ ...album, currency: 'USD' }), { id }).state;
    const second = 'b'.repeat(24);
    state = changeWallet(state, 'save_album', form({ ...album, currency: 'IDR' }), { id: second }).state;
    state = changeWallet(state, 'save_entry', form({ album_id: id, type: 'deposit', amount: '1250', currency: 'USD' })).state;
    state = changeWallet(state, 'save_entry', form({ album_id: second, type: 'deposit', amount: '50000', currency: 'IDR' })).state;
    const restored = await decodeBackup(new Blob([await encodeBackup(state)]));
    assert.deepEqual(restored.state.albums.map(row => row.currency), ['USD', 'IDR']);
    assert.deepEqual(walletSnapshot(restored.state).albums.map(row => row.balance).sort((a, b) => a - b), [1250, 50000]);
    const csv = activityCsv(state.entries, state.albums);
    assert.match(csv, /Mata uang,Nominal/);
    assert.match(csv, /,USD,12\.50,/);
    assert.match(csv, /,IDR,50000,/);
});

test('Wallet dan cadangan versi 2 menurunkan mata uang global ke setiap album', async () => {
    const state = changeWallet(emptyWallet(), 'save_album', form({ ...album, currency: 'USD' }), { id }).state;
    const legacy = { ...state, version: 2, albums: state.albums.map(({ currency, ...row }) => row) };
    const normalized = validateWallet(legacy);
    assert.equal(normalized.albums[0].currency, 'USD');
    assert.equal(normalized.albums[0].target, 100001);
    const backup = JSON.parse(await encodeBackup(state));
    backup.version = 2;
    backup.fractionDigits = 2;
    delete backup.albums[0].currency;
    delete backup.albums[0].fractionDigits;
    const restored = await decodeBackup(new Blob([JSON.stringify(backup)]));
    assert.equal(restored.state.albums[0].currency, 'USD');
    assert.equal(restored.state.albums[0].target, 100001);
});

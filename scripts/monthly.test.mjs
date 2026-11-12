import assert from 'node:assert/strict';
import test from 'node:test';
import { availableMonths, compareMonths, createMonthlyReport, formatMonth, monthRange, resolveMonth, savingRoutine, shiftMonth, summarizeMonth } from '../assets/js/monthly.js';
import { renderMonthlyReport } from '../assets/js/monthly-view.js';

function entry(id, date, amount, type = 'deposit', albumId = 'a', createdAt = `${date} 12:00:00`) {
    return { id, date, amount, type, albumId, createdAt };
}

test('setoran, penarikan, saldo bersih, dan jumlah catatan dihitung terpisah', () => {
    const entries = [entry('1', '2026-11-01', 500000), entry('2', '2026-11-02', 100000, 'withdrawal'), entry('3', '2026-10-31', 900000)];
    const result = summarizeMonth(entries, '2026-11');
    assert.equal(result.deposits, 500000);
    assert.equal(result.withdrawals, 100000);
    assert.equal(result.net, 400000);
    assert.equal(result.count, 2);
});

test('tanggal transaksi menentukan bulan, bukan waktu catatan dibuat', () => {
    const entries = [entry('1', '2026-11-30', 1000, 'deposit', 'a', '2026-12-01 08:00:00')];
    assert.equal(summarizeMonth(entries, '2026-11').count, 1);
    assert.equal(summarizeMonth(entries, '2026-12').count, 0);
});

test('filter album memakai catatan yang sama untuk ringkasan dan riwayat', () => {
    const entries = [entry('1', '2026-11-01', 1000), entry('2', '2026-11-02', 2500, 'deposit', 'b')];
    const report = createMonthlyReport(entries, 'current', '2026-11-12', 'b');
    assert.equal(report.summary.deposits, 2500);
    assert.equal(report.summary.count, 1);
    assert.equal(report.summary.entries[0].albumId, 'b');
    assert.equal(report.chart.at(-1).deposits, 2500);
});

test('riwayat diurutkan berdasarkan tanggal tanpa mengubah array asal', () => {
    const entries = [entry('1', '2026-11-01', 1000), entry('2', '2026-11-03', 2000), entry('3', '2026-11-02', 3000)];
    assert.deepEqual(summarizeMonth(entries, '2026-11').entries.map(item => item.id), ['2', '3', '1']);
    assert.deepEqual(entries.map(item => item.id), ['1', '2', '3']);
});

test('bulan berjalan dibandingkan sampai tanggal yang sama', () => {
    const entries = [entry('1', '2026-10-02', 500), entry('2', '2026-10-30', 9000), entry('3', '2026-11-01', 1000)];
    const result = compareMonths(entries, '2026-11', '2026-11-12');
    assert.equal(result.previous.deposits, 500);
    assert.equal(result.current.deposits, 1000);
    assert.equal(result.percentage, 100);
    assert.equal(result.kind, 'increase');
    assert.equal(result.throughDay, 12);
    assert.equal(result.previousThroughDay, 12);
});

test('bulan selesai dibandingkan secara penuh meskipun sekarang masih awal bulan', () => {
    const entries = [entry('1', '2026-09-30', 2000), entry('2', '2026-10-30', 1000)];
    const result = compareMonths(entries, '2026-10', '2026-11-02');
    assert.equal(result.partial, false);
    assert.equal(result.previous.deposits, 2000);
    assert.equal(result.current.deposits, 1000);
    assert.equal(result.percentage, -50);
    assert.equal(result.kind, 'decrease');
});

test('perbandingan Februari mengikuti panjang bulan dan tahun kabisat', () => {
    assert.equal(compareMonths([], '2024-03', '2024-03-31').previousThroughDay, 29);
    assert.equal(compareMonths([], '2025-03', '2025-03-31').previousThroughDay, 28);
});

test('pembanding nol tidak menghasilkan persentase tak terhingga', () => {
    const entries = [entry('1', '2026-07-01', 1000), entry('2', '2026-09-01', 500)];
    const result = compareMonths(entries, '2026-09', '2026-09-12');
    assert.equal(result.kind, 'started');
    assert.equal(result.percentage, null);
    assert.equal(result.difference, 500);
});

test('catatan pertama belum dinilai naik atau turun', () => {
    const result = compareMonths([entry('1', '2026-11-01', 500)], '2026-11', '2026-11-12');
    assert.equal(result.kind, 'insufficient');
});

test('riwayat yang baru dimulai setelah tanggal pembanding belum cukup untuk perbandingan', () => {
    const entries = [entry('1', '2026-10-20', 1000), entry('2', '2026-11-02', 500)];
    assert.equal(compareMonths(entries, '2026-11', '2026-11-12').kind, 'insufficient');
});

test('bulan ini mengikuti November ke Desember, pilihan November tetap di November', () => {
    assert.equal(resolveMonth('current', '2026-11-30'), '2026-11');
    assert.equal(resolveMonth('current', '2026-12-01'), '2026-12');
    assert.equal(resolveMonth('2026-11', '2026-12-01'), '2026-11');
    assert.equal(formatMonth('2026-11', '2026-11'), 'Bulan ini · November 2026');
    assert.equal(formatMonth('2026-11', '2026-12'), 'November 2026');
    assert.equal(formatMonth('2026-12', '2026-12'), 'Bulan ini · Desember 2026');
});

test('pergantian tahun mempertahankan tahun dan enam bulan kalender', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.deepEqual(monthRange('2026-01'), ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
    assert.equal(resolveMonth('current', '2027-01-01'), '2027-01');
});

test('riwayat lama dan bulan kosong di antaranya tetap dapat dipilih', () => {
    const entries = [entry('1', '2020-01-01', 1000)];
    const options = availableMonths(entries, '2026-12-01');
    assert.equal(options[0], '2026-12');
    assert.ok(options.includes('2020-01'));
    assert.ok(options.includes('2024-06'));
});

test('bulan baru kosong tidak memindahkan atau menghapus catatan bulan lalu', () => {
    const entries = [entry('1', '2026-11-30', 1000)];
    const report = createMonthlyReport(entries, 'current', '2026-12-01');
    assert.equal(report.month, '2026-12');
    assert.equal(report.summary.count, 0);
    assert.equal(summarizeMonth(entries, '2026-11').count, 1);
});

test('bulan berjalan tanpa setoran tidak memutus rutinitas bulan sebelumnya', () => {
    const entries = monthRange('2026-12').map((month, index) => entry(String(index), `${month}-01`, 1000));
    const result = savingRoutine(entries, '2027-01-12');
    assert.equal(result.observedMonths, 6);
    assert.equal(result.activeMonths, 6);
    assert.equal(result.streak, 6);
    assert.equal(savingRoutine([...entries, entry('7', '2027-01-01', 1)], '2027-01-12').streak, 7);
});

test('nominal turun dan penarikan tidak menghapus fakta adanya setoran rutin', () => {
    const entries = [entry('1', '2026-08-01', 1000), entry('2', '2026-09-01', 50), entry('3', '2026-09-02', 100, 'withdrawal')];
    const result = savingRoutine(entries, '2026-10-12');
    assert.equal(result.activeMonths, 2);
    assert.equal(result.observedMonths, 2);
    assert.equal(result.streak, 2);
    assert.equal(summarizeMonth(entries, '2026-09').net, -50);
});

test('perubahan tanggal dan penghapusan catatan langsung mengubah laporan', () => {
    const original = [entry('1', '2026-10-31', 1000)];
    const edited = [{ ...original[0], date: '2026-11-01' }];
    assert.equal(summarizeMonth(original, '2026-10').deposits, 1000);
    assert.equal(summarizeMonth(edited, '2026-10').deposits, 0);
    assert.equal(summarizeMonth(edited, '2026-11').deposits, 1000);
    assert.equal(summarizeMonth([], '2026-11').count, 0);
});

test('tampilan kosong tidak menampilkan data palsu atau NaN', () => {
    const html = renderMonthlyReport(createMonthlyReport([], 'current', '2026-12-01'));
    assert.match(html, /Bulan ini · Desember 2026/);
    assert.match(html, /0 catatan/);
    assert.match(html, /Belum ada catatan pembanding/);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
    assert.equal((html.match(/data-report-month=/g) || []).length, 6);
});

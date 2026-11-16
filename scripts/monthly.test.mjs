import assert from 'node:assert/strict';
import test from 'node:test';
import { availableMonths, compareMonths, createMonthlyReport, formatMonth, monthRange, recordingHistory, resolveMonth, savingRoutine, shiftMonth, summarizeMonth } from '../assets/js/monthly.js';
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
    assert.equal(report.chart.length, 0, 'Bulan berjalan belum masuk rekam jejak');
    assert.equal(report.history.firstDate, '2026-11-02');
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
    assert.equal(savingRoutine([...entries, entry('7', '2027-01-01', 1)], '2027-01-12').streak, 6, 'Bulan berjalan belum menambah rentetan bulan selesai');
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
    const report = createMonthlyReport([], 'current', '2026-12-01');
    const html = renderMonthlyReport(report);
    assert.match(html, /Statistikmu dimulai dari catatan pertama/);
    assert.equal(report.history.firstDate, null);
    assert.equal(report.history.completedCount, 0);
    assert.deepEqual(report.chart, []);
    assert.deepEqual(availableMonths([], '2026-12-01'), ['2026-12']);
    assert.doesNotMatch(html, /statistics-metrics|month-chart|6 bulan|1 bulan|data-report-month=/);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
});

test('catatan pertama hari ini atau kemarin belum membentuk bulan riwayat', () => {
    for (const date of ['2026-11-13', '2026-11-12']) {
        const entries = [entry('1', date, 50000)];
        const report = createMonthlyReport(entries, 'current', '2026-11-13');
        assert.equal(report.summary.deposits, 50000);
        assert.equal(report.history.firstDate, date);
        assert.equal(report.history.completedCount, 0);
        assert.deepEqual(report.chart, []);
        assert.deepEqual(availableMonths(entries, '2026-11-13'), ['2026-11']);
        assert.equal(report.routine.observedMonths, 0);
        assert.equal(report.routine.streak, 0);
        const html = renderMonthlyReport(report);
        assert.match(html, /Bulan pertamamu masih berjalan/);
        assert.match(html, /Desember 2026/);
        assert.doesNotMatch(html, /Oktober 2026|data-report-month=|data-period-month=|id="report-month"|bulan berturut-turut|Setoran 1 bulan/);
    }
});

test('mulai November baru memiliki satu bulan riwayat setelah masuk Desember', () => {
    const entries = [entry('1', '2026-11-13', 50000), entry('2', '2026-11-30', 25000)];
    const november = createMonthlyReport(entries, 'current', '2026-11-30');
    const december = createMonthlyReport(entries, 'current', '2026-12-01');
    assert.equal(november.history.completedCount, 0);
    assert.equal(december.history.completedCount, 1);
    assert.deepEqual(december.chart.map(item => item.month), ['2026-11']);
    assert.equal(december.chart[0].deposits, 75000);
    assert.equal(december.summary.count, 0);
    assert.equal(december.routine.observedMonths, 1);
    assert.equal(december.routine.streak, 1);
    assert.deepEqual(availableMonths(entries, '2026-12-01'), ['2026-12', '2026-11']);
    const html = renderMonthlyReport(december);
    assert.match(html, /Setoran 1 bulan selesai/);
    assert.equal((html.match(/data-report-month=/g) || []).length, 1);
});

test('bulan kosong setelah mulai mencatat masuk riwayat dengan nilai nol', () => {
    const entries = [entry('1', '2026-11-13', 50000)];
    const report = createMonthlyReport(entries, 'current', '2027-01-01');
    assert.equal(report.history.completedCount, 2);
    assert.deepEqual(report.chart.map(item => item.month), ['2026-11', '2026-12']);
    assert.equal(report.chart[1].deposits, 0);
    assert.equal(report.chart[1].count, 0);
    assert.equal(report.routine.activeMonths, 1);
    assert.equal(report.routine.observedMonths, 2);
    assert.equal(report.routine.streak, 0);
});

test('tombol pindah bulan mengikuti awal album, melewati bulan kosong, dan kembali ke Bulan ini', () => {
    const entries = [entry('1', '2026-08-01', 1000), entry('2', '2026-11-13', 50000, 'deposit', 'b')];
    const report = selection => renderMonthlyReport(createMonthlyReport(entries, selection, '2027-01-08', 'b'));
    assert.match(report('current'), /id="report-previous"\s+data-period-month="2026-12"/);
    assert.match(report('current'), /id="report-next"\s+data-period-month=""[^>]+aria-disabled="true"/);
    assert.match(report('2026-12'), /id="report-next"\s+data-period-month="current"/);
    assert.match(report('2026-11'), /id="report-previous"\s+data-period-month=""[^>]+aria-disabled="true"/);
    assert.doesNotMatch(report('2026-11'), /Agustus 2026/);
});

test('rincian laporan menjumlahkan jenis yang dipilih per album pada bulan laporan', () => {
    const albums = [{ id: 'a', name: 'Dana & darurat' }, { id: 'b', name: '<Kamera>' }];
    const entries = [
        entry('1', '2026-10-01', 7000, 'deposit', 'a'),
        entry('2', '2026-10-02', 2000, 'withdrawal', 'a'),
        entry('3', '2026-10-03', 4000, 'deposit', 'a'),
        entry('4', '2026-10-04', 5000, 'deposit', 'b'),
        entry('5', '2026-11-05', 8000, 'deposit', 'b')
    ];
    const report = createMonthlyReport(entries, '2026-10', '2026-11-13');
    const breakdown = type => renderMonthlyReport(report, { albums, type }).split('id="report-breakdown"')[1].split('class="report-net"')[0];
    assert.match(breakdown('deposit'), /Dana &amp; darurat<\/span><strong>Rp\s11\.000/);
    assert.match(breakdown('deposit'), /&lt;Kamera&gt;<\/span><strong>Rp\s5\.000/);
    assert.match(breakdown('withdrawal'), /Dana &amp; darurat<\/span><strong>Rp\s2\.000/);
    assert.doesNotMatch(breakdown('withdrawal'), /Kamera/);
    assert.match(renderMonthlyReport(report, { albums }), /Tabungan bersih<\/span><strong>Rp\s14\.000/);
});

test('grafik dibatasi enam bulan selesai nyata; periode lama tetap tersedia', () => {
    const entries = [entry('1', '2025-05-02', 1000)];
    const report = createMonthlyReport(entries, 'current', '2026-11-13');
    assert.equal(report.history.completedCount, 18);
    assert.deepEqual(report.chart.map(item => item.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    assert.ok(availableMonths(entries, '2026-11-13').includes('2025-05'));
    assert.equal(createMonthlyReport(entries, '2025-05', '2026-11-13').summary.deposits, 1000);
    assert.match(renderMonthlyReport(report), /6 bulan selesai terakhir/);
});

test('awal riwayat dihitung masing-masing album, bukan mengikuti album yang lebih lama', () => {
    const entries = [entry('1', '2026-10-01', 1000), entry('2', '2026-11-12', 500, 'deposit', 'b')];
    assert.equal(createMonthlyReport(entries, 'current', '2026-11-13').history.completedCount, 1);
    const b = createMonthlyReport(entries, 'current', '2026-11-13', 'b');
    assert.equal(b.history.firstDate, '2026-11-12');
    assert.equal(b.history.completedCount, 0);
    assert.deepEqual(b.chart, []);
    assert.deepEqual(availableMonths(entries, '2026-11-13', 'b'), ['2026-11']);
    const empty = createMonthlyReport(entries, 'current', '2026-11-13', 'c');
    assert.equal(empty.history.hasEntries, false);
    assert.match(renderMonthlyReport(empty), /Album ini belum punya catatan/);
});

test('edit dan hapus catatan pertama menghitung ulang awal riwayat dan periode yang valid', () => {
    const original = [entry('1', '2026-09-01', 1000), entry('2', '2026-11-12', 500)];
    assert.equal(recordingHistory(original, '2026-11-13').completedCount, 2);
    const edited = [{ ...original[0], date: '2026-11-01' }, original[1]];
    assert.equal(recordingHistory(edited, '2026-11-13').completedCount, 0);
    const deleted = original.slice(1);
    assert.equal(createMonthlyReport(deleted, '2026-09', '2026-11-13').month, '2026-11');
    assert.deepEqual(availableMonths(deleted, '2026-11-13'), ['2026-11']);
    assert.equal(recordingHistory([], '2026-11-13').firstDate, null);
});

test('tanggal transaksi mundur dan pergantian tahun memakai kalender nyata', () => {
    const backdated = [entry('1', '2026-11-30', 1000, 'deposit', 'a', '2026-12-01 08:00:00')];
    assert.equal(createMonthlyReport(backdated, 'current', '2026-12-01').history.completedCount, 1);
    const newYear = createMonthlyReport([entry('2', '2026-12-31', 1000)], 'current', '2027-01-01');
    assert.deepEqual(newYear.chart.map(item => item.month), ['2026-12']);
    const february = createMonthlyReport([entry('3', '2028-02-29', 1000)], 'current', '2028-03-01');
    assert.deepEqual(february.chart.map(item => item.month), ['2028-02']);
    const future = createMonthlyReport([entry('4', '2026-12-01', 1000)], 'current', '2026-11-13');
    assert.equal(future.history.hasEntries, false);
    assert.equal(future.summary.count, 0);
});

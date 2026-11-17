import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { scheduleOnOrAfter, nextOccurrence, currentPeriod, nextPlanDate, periodDeposits, suggestedAmount, estimatedCompletion } from '../assets/js/domain/saving-plan.js';

const daily = { frequency: 'daily', startDate: '2026-11-13', amount: 100000, scheduleDay: 1 };
const weekly = { ...daily, frequency: 'weekly', scheduleDay: 5 };
const monthly = { ...daily, frequency: 'monthly', scheduleDay: 31 };
test('Jadwal menghormati tanggal mulai dan hari pilihan', () => {
    assert.equal(scheduleOnOrAfter(daily, '2026-11-01'), '2026-11-13');
    assert.equal(scheduleOnOrAfter(weekly, '2026-11-14'), '2026-11-20');
    assert.equal(scheduleOnOrAfter({ ...weekly, scheduleDay: 0 }, '2026-11-13'), '2026-11-15');
    assert.equal(nextOccurrence(weekly, '2026-11-13'), '2026-11-20');
    assert.equal(currentPeriod(weekly, '2026-11-12'), null);
});
test('Tanggal 31 kembali ke tanggal 31 setelah bulan pendek, termasuk tahun kabisat', () => {
    assert.equal(scheduleOnOrAfter(monthly, '2027-02-01'), '2027-02-28');
    assert.equal(nextOccurrence(monthly, '2027-02-28'), '2027-03-31');
    assert.equal(scheduleOnOrAfter(monthly, '2028-02-01'), '2028-02-29');
    assert.equal(nextOccurrence(monthly, '2026-12-31'), '2027-01-31');
    assert.deepEqual(currentPeriod(monthly, '2027-03-01'), { start: '2027-02-28', end: '2027-03-31' });
    assert.equal(currentPeriod(monthly, '2026-11-20'), null);
});
test('Setoran periode dijumlahkan; penarikan, album lain, dan tanggal lain tidak memenuhi jadwal', () => {
    const entries = [
        { albumId: 'a', type: 'deposit', date: '2026-11-13', amount: 60000 },
        { albumId: 'a', type: 'deposit', date: '2026-11-14', amount: 40000 },
        { albumId: 'a', type: 'withdrawal', date: '2026-11-14', amount: 40000 },
        { albumId: 'b', type: 'deposit', date: '2026-11-13', amount: 999999 },
        { albumId: 'a', type: 'deposit', date: '2026-11-12', amount: 999999 },
        { albumId: 'a', type: 'deposit', date: '2026-11-20', amount: 999999 },
    ];
    assert.equal(periodDeposits(weekly, entries, 'a', '2026-11-13'), 60000);
    assert.equal(periodDeposits(weekly, entries, 'a', '2026-11-19'), 100000);
    assert.equal(nextPlanDate(daily, entries, 'a', '2026-11-13'), '2026-11-13');
    assert.equal(nextPlanDate({ ...daily, amount: 60000 }, entries, 'a', '2026-11-13'), '2026-11-14');
});
test('Saran nominal menghitung jadwal sebenarnya dan pembulatan rupiah ke atas', () => {
    assert.equal(suggestedAmount(weekly, 1000001, '2026-11-27', '2026-11-13'), 333334);
    assert.equal(suggestedAmount(weekly, 1000, '2026-11-19', '2026-11-14'), null);
    assert.equal(suggestedAmount(daily, 1000, null, '2026-11-13'), null);
    assert.equal(estimatedCompletion(weekly, 300000, '2026-11-13'), '2026-11-27');
    assert.equal(estimatedCompletion({ ...monthly, amount: 1 }, 1000000000000, '2026-11-13'), null);
});
test('Kalender PHP dan JavaScript konsisten melewati pergantian bulan dan tahun', () => {
    const cases = [];
    for (const plan of [daily, weekly, { ...weekly, scheduleDay: 0 }, monthly, { ...monthly, scheduleDay: 29 }]) {
        for (const date of ['2026-11-01', '2026-11-13', '2026-11-30', '2026-12-31', '2027-02-28', '2027-03-01', '2028-02-29']) {
            cases.push({ plan, date });
        }
    }
    const php = execFileSync('php', ['tests/saving-plan.test.php', '--calendar'], { input: JSON.stringify(cases), encoding: 'utf8' });
    assert.deepEqual(JSON.parse(php), cases.map(({ plan, date }) => ({ next: scheduleOnOrAfter(plan, date), period: currentPeriod(plan, date) })));
});

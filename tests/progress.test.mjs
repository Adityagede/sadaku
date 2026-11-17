import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProgress, formatProgress } from '../assets/js/domain/progress.js';

test('setoran Rp1.000 ke target Rp25 juta tetap memiliki progres', () => {
    const value = calculateProgress(1000, 25000000);
    assert.equal(value, 0.004);
    assert.equal(formatProgress(value), '0,004%');
});

test('progres mengikuti saldo setelah setoran dan penarikan', () => {
    const target = 1000000;
    assert.equal(calculateProgress(0, target), 0);
    assert.equal(calculateProgress(1000, target), 0.1);
    assert.equal(calculateProgress(2000, target), 0.2);
    assert.equal(calculateProgress(1000, target), 0.1);
    assert.equal(formatProgress(calculateProgress(0, target)), '0%');
});

test('saldo sangat kecil dibedakan dari saldo nol', () => {
    const value = calculateProgress(1, 1000000000000);
    assert.ok(value > 0);
    assert.equal(formatProgress(value), '<0,0001%');
});

test('batas desimal tidak bergeser karena pembulatan antara', () => {
    assert.equal(formatProgress(calculateProgress(1000, 1000000000)), '0,0001%');
    assert.equal(formatProgress(calculateProgress(9999, 10000)), '99,99%');
});

test('progres tidak ditampilkan 100% sebelum nominal target tercapai', () => {
    const almost = calculateProgress(999999, 1000000);
    assert.ok(almost < 100);
    assert.equal(formatProgress(almost), '>99,99%');
    assert.equal(formatProgress(calculateProgress(1000000, 1000000)), '100%');
    assert.equal(calculateProgress(1200000, 1000000), 100);
});

test('target tidak valid tidak menghasilkan NaN atau progres negatif', () => {
    assert.equal(calculateProgress(1000, 0), 0);
    assert.equal(calculateProgress(1000, NaN), 0);
    assert.equal(calculateProgress(-1000, 10000), 0);
});

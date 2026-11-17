import test from 'node:test';
import assert from 'node:assert/strict';
import { bindMoneyInputs, formatMoney, moneyEdit, moneyFormData, rawMoney, setMoneyValue } from '../assets/js/components/money-input.js';

test('Pemisah ribuan muncul saat digit bertambah tanpa mengubah nominal', () => {
    for (const [raw, formatted] of [['5', '5'], ['50', '50'], ['500', '500'], ['5000', '5.000'], ['50000', '50.000'], ['500000', '500.000'], ['1000000000000', '1.000.000.000.000'], ['', '']]) {
        assert.equal(formatMoney(raw), formatted);
        assert.equal(rawMoney(formatted), raw);
    }
    assert.equal(formatMoney('Rp 500.000'), '500.000');
    assert.equal(formatMoney('00050000'), '50.000');
    for (const invalid of ['1,5', '-5000', '5e3', 'abc']) assert.equal(rawMoney(invalid), null);
});
test('Kursor mengikuti digit yang diedit, termasuk sisipan dan penghapusan di tengah', () => {
    assert.deepEqual(moneyEdit('50000', 5), { value: '50.000', caret: 6 });
    assert.deepEqual(moneyEdit('510.000', 2), { value: '510.000', caret: 2 });
    assert.deepEqual(moneyEdit('5.0000', 6), { value: '50.000', caret: 6 });
    assert.deepEqual(moneyEdit('5000', 1), { value: '5.000', caret: 1 });
    assert.deepEqual(moneyEdit('0005', 4), { value: '5', caret: 1 });
    assert.deepEqual(moneyEdit('', 0), { value: '', caret: 0 });
});

class MoneyInput extends EventTarget {
    constructor(value = '') { super(); this.value = value; this.selectionStart = value.length; this.selectionEnd = value.length; this.name = 'amount'; }
    setCustomValidity(message) { this.error = message; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
}
test('Backspace/Delete pada titik tetap menghapus digit dan validasi batas tetap bekerja', () => {
    const input = new MoneyInput('50.000');
    bindMoneyInputs({ querySelectorAll: () => [input] });
    input.setSelectionRange(3, 3);
    const event = new Event('beforeinput', { cancelable: true });
    Object.defineProperty(event, 'inputType', { value: 'deleteContentBackward' });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(input.value, '5.000');
    setMoneyValue(input, 0);
    assert.match(input.error, /Nominal/);
    setMoneyValue(input, 1000000000001);
    assert.match(input.error, /Nominal/);
    setMoneyValue(input, 50000);
    assert.equal(input.error, '');
    input.setSelectionRange(2, 2);
    const forward = new Event('beforeinput', { cancelable: true });
    Object.defineProperty(forward, 'inputType', { value: 'deleteContentForward' });
    input.dispatchEvent(forward);
    assert.equal(input.value, '5.000');
});
test('FormData mengirim angka mentah dan melewati input rencana yang dinonaktifkan', t => {
    const original = globalThis.FormData;
    globalThis.FormData = class extends Map { constructor() { super([['target', '500.000'], ['amount', '50.000']]); } };
    t.after(() => { globalThis.FormData = original; });
    const body = moneyFormData({ querySelectorAll: () => [
        { name: 'target', value: '500.000' }, { name: 'amount', value: '50.000' }, { name: 'plan_amount', value: '25.000' },
    ] });
    assert.equal(body.get('target'), '500000');
    assert.equal(body.get('amount'), '50000');
    assert.equal(body.has('plan_amount'), false);
});

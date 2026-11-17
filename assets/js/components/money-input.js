import { currentCurrency, currencyInfo, decimalAmount } from '../domain/currency.js';
const MAXIMUM = 1000000000000;

export function rawMoney(value, selected = currentCurrency().code) {
    const { code, digits: precision } = currencyInfo(selected);
    if (code !== 'IDR') {
        const text = String(value).trim();
        if (!text) return '';
        const pattern = precision ? /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
        if (!pattern.test(text)) return null;
        const [whole, fraction = ''] = text.replaceAll(',', '').split('.');
        return (whole + fraction.padEnd(precision, '0')).replace(/^0+(?=\d)/, '');
    }
    const digits = String(value).trim().replace(/^Rp\s*/i, '').replace(/\./g, '');
    return /^\d*$/.test(digits) ? digits.replace(/^0+(?=\d)/, '') : null;
}

export function formatMoney(value, code = currentCurrency().code) {
    if (code !== 'IDR') return String(value);
    const digits = rawMoney(value, code);
    return digits === null ? String(value) : digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function moneyEdit(value, caret, code = currentCurrency().code) {
    if (code !== 'IDR') return { value, caret };
    const formatted = formatMoney(value, code);
    const digits = rawMoney(value, code);
    if (digits === null) return { value, caret };
    const originalDigits = value.replace(/\D/g, '');
    const before = value.slice(0, caret).replace(/\D/g, '').length;
    const wanted = Math.max(0, before - (originalDigits.length - digits.length));
    let position = 0;
    let seen = 0;
    while (position < formatted.length && seen < wanted) {
        if (/\d/.test(formatted[position])) seen++;
        position++;
    }
    return { value: formatted, caret: position };
}

function inputCurrency(input) { return input.dataset?.currency || currentCurrency().code; }
function validate(input) {
    const info = currencyInfo(inputCurrency(input));
    const digits = rawMoney(input.value, info.code);
    input.setCustomValidity(digits === null ? (info.code === 'IDR' ? 'Gunakan rupiah bulat, misalnya 50.000.' : info.digits ? 'Gunakan titik untuk sen, misalnya 1250.50; maksimal dua desimal.' : 'Gunakan nominal bulat, misalnya 1250.') : digits !== '' && (Number(digits) < 1 || Number(digits) > MAXIMUM) ? 'Nominal di luar batas pencatatan.' : '');
}

export function setMoneyValue(input, value) {
    const code = inputCurrency(input);
    input.value = code === 'IDR' ? formatMoney(value, code) : value === '' ? '' : decimalAmount(Number(value), code);
    validate(input);
}

export function bindMoneyInputs(root) {
    for (const input of root.querySelectorAll('[data-money]')) {
        function update() {
            const selection = input.selectionStart ?? input.value.length;
            const result = moneyEdit(input.value, selection, inputCurrency(input));
            input.value = result.value;
            input.setSelectionRange(result.caret, result.caret);
            validate(input);
        }
        input.addEventListener('input', event => { if (!event.isComposing) update(); });
        input.addEventListener('compositionend', update);
        input.addEventListener('beforeinput', event => {
            if (inputCurrency(input) !== 'IDR') return;
            const caret = input.selectionStart;
            if (caret !== input.selectionEnd) return;
            const backward = event.inputType === 'deleteContentBackward' && input.value[caret - 1] === '.';
            const forward = event.inputType === 'deleteContentForward' && input.value[caret] === '.';
            if (!backward && !forward) return;
            event.preventDefault();
            const start = backward ? caret - 2 : caret;
            input.value = input.value.slice(0, start) + input.value.slice(start + 2);
            input.setSelectionRange(start, start);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        validate(input);
    }
}

export function moneyFormData(form) {
    const body = new FormData(form);
    const code = form.dataset?.currency || currentCurrency().code;
    for (const input of form.querySelectorAll('[data-money]')) {
        if (body.has(input.name)) body.set(input.name, rawMoney(input.value, code) ?? input.value);
    }
    body.set('currency', code);
    return body;
}

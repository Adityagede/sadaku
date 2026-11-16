const MAXIMUM = 1000000000000;

export function rawMoney(value) {
    const digits = String(value).trim().replace(/^Rp\s*/i, '').replace(/\./g, '');
    return /^\d*$/.test(digits) ? digits.replace(/^0+(?=\d)/, '') : null;
}

export function formatMoney(value) {
    const digits = rawMoney(value);
    return digits === null ? String(value) : digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function moneyEdit(value, caret) {
    const formatted = formatMoney(value);
    const digits = rawMoney(value);
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

function validate(input) {
    const digits = rawMoney(input.value);
    input.setCustomValidity(digits === null ? 'Gunakan angka rupiah bulat, misalnya 50.000.' : digits !== '' && (Number(digits) < 1 || Number(digits) > MAXIMUM) ? 'Nominal harus antara Rp1 dan Rp1.000.000.000.000.' : '');
}

export function setMoneyValue(input, value) {
    input.value = formatMoney(value);
    validate(input);
}

export function bindMoneyInputs(root) {
    for (const input of root.querySelectorAll('[data-money]')) {
        function update() {
            const selection = input.selectionStart ?? input.value.length;
            const result = moneyEdit(input.value, selection);
            input.value = result.value;
            input.setSelectionRange(result.caret, result.caret);
            validate(input);
        }
        input.addEventListener('input', event => { if (!event.isComposing) update(); });
        input.addEventListener('compositionend', update);
        input.addEventListener('beforeinput', event => {
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
    for (const input of form.querySelectorAll('[data-money]')) {
        if (body.has(input.name)) body.set(input.name, rawMoney(input.value) ?? input.value);
    }
    return body;
}

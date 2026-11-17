import { currencyInfo } from '../domain/currency.js';
import { setMoneyValue } from './money-input.js';

export function configureMoneyForm(form, code, clear = false) {
    const info = currencyInfo(code);
    form.dataset.currency = code;
    for (const label of form.querySelectorAll('[data-currency-label]')) label.textContent = code === 'IDR' ? 'Rp' : code;
    for (const input of form.querySelectorAll('[data-money]')) {
        input.dataset.currency = code;
        input.inputMode = info.digits ? 'decimal' : 'numeric';
        input.placeholder = code === 'IDR' ? '50.000' : info.digits ? '1250.50' : '1250';
        let hint = document.getElementById(`${input.id}-format`);
        if (!hint) {
            hint = document.createElement('p');
            hint.id = `${input.id}-format`;
            hint.className = 'money-format-help';
            input.closest('.money-input').after(hint);
            input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
        }
        hint.textContent = info.digits ? 'Gunakan titik untuk pecahan, misalnya 1250.50.' : '';
        hint.hidden = !info.digits;
        if (clear) setMoneyValue(input, '');
    }
}

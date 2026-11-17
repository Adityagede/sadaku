// Amounts use integer units: whole rupiah/yen, cents for two-decimal currencies.
export const currencies = Object.freeze([
    { code: 'IDR', name: 'Rupiah Indonesia', digits: 0, locale: 'id-ID' },
    { code: 'USD', name: 'Dolar Amerika Serikat', digits: 2, locale: 'en-US' },
    { code: 'EUR', name: 'Euro', digits: 2, locale: 'en-IE' },
    { code: 'SGD', name: 'Dolar Singapura', digits: 2, locale: 'en-SG' },
    { code: 'GBP', name: 'Pound sterling', digits: 2, locale: 'en-GB' },
    { code: 'AUD', name: 'Dolar Australia', digits: 2, locale: 'en-AU' },
    { code: 'CAD', name: 'Dolar Kanada', digits: 2, locale: 'en-CA' },
    { code: 'MYR', name: 'Ringgit Malaysia', digits: 2, locale: 'en-MY' },
    { code: 'JPY', name: 'Yen Jepang', digits: 0, locale: 'ja-JP' },
    { code: 'CHF', name: 'Franc Swiss', digits: 2, locale: 'en-US' },
]);
export function currencyInfo(code) {
    const value = currencies.find(item => item.code === code);
    if (!value) throw new Error('Mata uang tidak didukung.');
    return value;
}
let active = 'IDR';
export function setCurrency(code) { currencyInfo(code); active = code; }
export function currentCurrency() { return currencyInfo(active); }
export function majorAmount(amount, code = active) { return amount / 10 ** currencyInfo(code).digits; }
export function decimalAmount(amount, code = active) {
    const digits = currencyInfo(code).digits;
    const sign = amount < 0 ? '-' : '';
    const value = String(Math.abs(amount)).padStart(digits + 1, '0');
    return sign + (digits ? `${value.slice(0, -digits)}.${value.slice(-digits)}` : value);
}
export const moneyDisplay = { format(amount, selected = active) {
    const { code, digits, locale } = currencyInfo(selected);
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code,
        currencyDisplay: code === 'IDR' ? 'symbol' : 'code', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(decimalAmount(amount, code));
} };

export function albumCurrency(albums, albumId) { return albums.find(album => album.id === albumId)?.currency || 'IDR'; }
export function currencyGroups(albums) { return [...new Set(albums.map(album => album.currency || 'IDR'))].sort(); }

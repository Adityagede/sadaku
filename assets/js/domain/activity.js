import { currentCurrency, decimalAmount, albumCurrency, currencyGroups } from './currency.js';
export const ACTIVITY_PAGE_SIZE = 30;
export const DEFAULT_ACTIVITY_FILTERS = Object.freeze({ query: '', month: 'all', albumId: 'all', type: 'all' });

function descending(a, b) {
    return a === b ? 0 : a > b ? -1 : 1;
}

function sortActivity(entries) {
    return [...entries].sort((a, b) => descending(a.date, b.date)
        || descending(a.createdAt || '', b.createdAt || '') || descending(a.id, b.id));
}

export function activityPage(entries, limit = ACTIVITY_PAGE_SIZE) {
    const sorted = sortActivity(entries);
    const visible = sorted.slice(0, Math.max(ACTIVITY_PAGE_SIZE, limit));
    const days = new Map();
    for (const entry of visible) {
        if (!days.has(entry.date)) days.set(entry.date, []);
        days.get(entry.date).push(entry);
    }
    return { days: [...days].map(([date, entries]) => ({ date, entries })), hasMore: sorted.length > visible.length };
}

export function activityMonths(days) {
    const months = new Map();
    for (const { date, entries } of days) {
        const month = date.slice(0, 7);
        if (!months.has(month)) months.set(month, []);
        months.get(month).push(...entries);
    }
    return months;
}

export function activityTypeLabel(type) {
    return type === 'withdrawal' ? 'Penarikan' : 'Setoran';
}

export function filterActivity(entries, albums, { query, month, albumId, type }) {
    const names = new Map(albums.map(album => [album.id, album.name]));
    const terms = query.trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
    return entries.filter(entry => {
        if (month !== 'all' && entry.date.slice(0, 7) !== month) return false;
        if (albumId !== 'all' && entry.albumId !== albumId) return false;
        if (type !== 'all' && entry.type !== type) return false;
        const text = `${entry.note || ''} ${names.get(entry.albumId) || ''} ${activityTypeLabel(entry.type)}`.toLocaleLowerCase('id-ID');
        return terms.every(term => text.includes(term));
    });
}

export function activityCsv(entries, albums) {
    const mixed = currencyGroups(albums).length > 1;
    const single = currencyGroups(albums)[0] || currentCurrency().code;
    const names = new Map(albums.map(album => [album.id, album.name]));
    const csvText = value => {
        const text = String(value ?? '');
        // CSV readers can interpret imported album names and notes as formulas.
        const escaped = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text;
        return `"${escaped.replaceAll('"', '""')}"`;
    };
    const rows = sortActivity(entries).map(entry => [
        entry.date,
        csvText(names.get(entry.albumId) || 'Album'),
        activityTypeLabel(entry.type),
        ...(mixed ? [albumCurrency(albums, entry.albumId)] : []),
        decimalAmount(entry.type === 'withdrawal' ? -entry.amount : entry.amount, albumCurrency(albums, entry.albumId)),
        csvText(entry.note)
    ].join(','));
    return [`\uFEFFTanggal,Album,Jenis,${mixed ? 'Mata uang,Nominal' : `Nominal (${single === 'IDR' ? 'Rp' : single})`},Catatan`, ...rows].join('\r\n') + '\r\n';
}

export function activityDayLabel(date, today, formatDate) {
    if (date === today) return 'Hari ini';
    const yesterday = new Date(`${today}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return date === yesterday.toISOString().slice(0, 10) ? 'Kemarin' : formatDate(date);
}

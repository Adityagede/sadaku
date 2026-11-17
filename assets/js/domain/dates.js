const dates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const activityDates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const historyDates = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatActivityDate = date => activityDates.format(new Date(`${date}T00:00:00Z`));
const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });

export function today() {
    const parts = Object.fromEntries(todayParts.formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDate(value) {
    if (!value) return 'Tanpa batas waktu';
    const [year, month, day] = value.split('-').map(Number);
    return dates.format(new Date(year, month - 1, day));
}

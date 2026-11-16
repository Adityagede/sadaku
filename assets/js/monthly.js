const monthNames = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function shiftMonth(month, offset) {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, number - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function resolveMonth(selection, today) {
    return selection === 'current' ? today.slice(0, 7) : selection;
}

export function formatMonth(month, currentMonth = null) {
    const label = monthNames.format(new Date(`${month}-01T00:00:00Z`));
    return month === currentMonth ? `Bulan ini · ${label}` : label;
}

export function monthRange(endMonth, count = 6) {
    return Array.from({ length: count }, (_, index) => shiftMonth(endMonth, index - count + 1));
}

export function recordingHistory(entries, today, albumId = 'all') {
    const current = today.slice(0, 7);
    let firstDate = null;
    for (const entry of entries) {
        if ((albumId === 'all' || entry.albumId === albumId) && entry.date <= today && (!firstDate || entry.date < firstDate)) firstDate = entry.date;
    }
    const firstMonth = firstDate?.slice(0, 7) || null;
    const index = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
    const completedCount = firstMonth ? Math.max(0, index(current) - index(firstMonth)) : 0;
    return { hasEntries: firstDate !== null, firstDate, firstMonth, completedCount,
        completedMonths: monthRange(shiftMonth(current, -1), Math.min(6, completedCount)) };
}

export function availableMonths(entries, today, albumId = 'all') {
    const current = today.slice(0, 7);
    const first = recordingHistory(entries, today, albumId).firstMonth || current;
    const months = [];
    for (let month = current; month >= first; month = shiftMonth(month, -1)) months.push(month);
    return months;
}

export function summarizeMonth(entries, month, albumId = 'all', throughDay = 31) {
    const matching = entries.filter(entry => entry.date.slice(0, 7) === month
        && Number(entry.date.slice(8, 10)) <= throughDay
        && (albumId === 'all' || entry.albumId === albumId));
    matching.sort((a, b) => b.date.localeCompare(a.date)
        || (b.createdAt || '').localeCompare(a.createdAt || '')
        || b.id.localeCompare(a.id));
    let deposits = 0;
    let withdrawals = 0;
    for (const entry of matching) {
        if (entry.type === 'deposit') deposits += entry.amount;
        else withdrawals += entry.amount;
    }
    return { deposits, withdrawals, net: deposits - withdrawals, count: matching.length, entries: matching };
}

function daysInMonth(month) {
    const [year, number] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

export function compareMonths(entries, month, today, albumId = 'all') {
    const previousMonth = shiftMonth(month, -1);
    const partial = month === today.slice(0, 7);
    const throughDay = partial ? Number(today.slice(8, 10)) : daysInMonth(month);
    const previousThroughDay = partial ? Math.min(throughDay, daysInMonth(previousMonth)) : daysInMonth(previousMonth);
    const current = summarizeMonth(entries, month, albumId, throughDay);
    const previous = summarizeMonth(entries, previousMonth, albumId, previousThroughDay);
    const previousEnd = `${previousMonth}-${String(previousThroughDay).padStart(2, '0')}`;
    const observed = entries.some(entry => (albumId === 'all' || entry.albumId === albumId) && entry.date <= previousEnd && entry.date <= today);
    const difference = current.deposits - previous.deposits;
    const percentage = previous.deposits > 0 ? difference / previous.deposits * 100 : null;
    let kind = 'insufficient';
    if (observed) {
        if (previous.deposits === 0) kind = current.deposits > 0 ? 'started' : 'empty';
        else kind = difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'same';
    }
    return { current, previous, previousMonth, partial, throughDay, previousThroughDay, difference, percentage, kind };
}

export function savingRoutine(entries, today, albumId = 'all') {
    const currentMonth = today.slice(0, 7);
    const completedMonths = recordingHistory(entries, today, albumId).completedMonths;
    const depositMonths = new Set(entries.filter(entry => (albumId === 'all' || entry.albumId === albumId) && entry.type === 'deposit' && entry.date <= today).map(entry => entry.date.slice(0, 7)));
    const activeMonths = completedMonths.filter(month => depositMonths.has(month)).length;

    // A month only joins the record after the calendar month has finished.
    let cursor = shiftMonth(currentMonth, -1);
    let streak = 0;
    while (depositMonths.has(cursor)) {
        streak++;
        cursor = shiftMonth(cursor, -1);
    }
    return { activeMonths, observedMonths: completedMonths.length, streak, enoughHistory: completedMonths.length >= 2 };
}

export function createMonthlyReport(entries, selection, today, albumId = 'all') {
    const scoped = entries.filter(entry => (albumId === 'all' || entry.albumId === albumId) && entry.date <= today);
    const history = recordingHistory(scoped, today);
    const requested = resolveMonth(selection, today);
    const months = availableMonths(scoped, today);
    const month = months.includes(requested) ? requested : today.slice(0, 7);
    return {
        month,
        months,
        albumId,
        history,
        currentMonth: today.slice(0, 7),
        summary: summarizeMonth(scoped, month),
        comparison: compareMonths(scoped, month, today),
        chart: history.completedMonths.map(key => ({ month: key, ...summarizeMonth(scoped, key) })),
        routine: savingRoutine(scoped, today)
    };
}

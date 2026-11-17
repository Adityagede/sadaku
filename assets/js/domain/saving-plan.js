// Calendar dates use UTC arithmetic; all plan dates and reminder times are WIB.
const DAY = 86400000;
const parse = value => new Date(`${value}T00:00:00Z`);
const iso = date => date.toISOString().slice(0, 10);
export const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function monthlyDate(year, month, day) {
    return iso(new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))));
}

export function scheduleOnOrAfter(plan, date) {
    const value = date < plan.startDate ? plan.startDate : date;
    const cursor = parse(value);
    if (plan.frequency === 'daily') return value;
    if (plan.frequency === 'weekly') {
        cursor.setUTCDate(cursor.getUTCDate() + (plan.scheduleDay - cursor.getUTCDay() + 7) % 7);
        return iso(cursor);
    }
    const scheduled = monthlyDate(cursor.getUTCFullYear(), cursor.getUTCMonth(), plan.scheduleDay);
    return scheduled >= value ? scheduled : monthlyDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, plan.scheduleDay);
}

export function nextOccurrence(plan, date) {
    return scheduleOnOrAfter(plan, iso(new Date(parse(date).getTime() + DAY)));
}

export function currentPeriod(plan, date) {
    if (date < plan.startDate) return null;
    const cursor = parse(date);
    let start = date;
    if (plan.frequency === 'weekly') {
        cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay() - plan.scheduleDay + 7) % 7);
        start = iso(cursor);
    } else if (plan.frequency === 'monthly') {
        start = monthlyDate(cursor.getUTCFullYear(), cursor.getUTCMonth(), plan.scheduleDay);
        if (start > date) start = monthlyDate(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, plan.scheduleDay);
    }
    return start < plan.startDate ? null : { start, end: nextOccurrence(plan, start) };
}

export function periodDeposits(plan, entries, albumId, date) {
    const period = currentPeriod(plan, date);
    return period ? entries.filter(entry => entry.albumId === albumId && entry.type === 'deposit' && entry.date >= period.start && entry.date < period.end && entry.date <= date).reduce((total, entry) => total + entry.amount, 0) : 0;
}

export function nextPlanDate(plan, entries, albumId, date) {
    let scheduled = scheduleOnOrAfter(plan, date);
    if (scheduled === date && periodDeposits(plan, entries, albumId, date) >= plan.amount) scheduled = nextOccurrence(plan, date);
    return scheduled;
}

export function suggestedAmount(plan, remaining, deadline, date) {
    if (!deadline || deadline < date || remaining <= 0) return null;
    let count = 0;
    for (let day = scheduleOnOrAfter(plan, date); day <= deadline && count < 100000; day = nextOccurrence(plan, day)) count++;
    return count ? Math.ceil(remaining / count) : null;
}

export function estimatedCompletion(plan, remaining, date) {
    const count = Math.ceil(remaining / plan.amount);
    if (count < 1 || count > 10000) return null;
    let scheduled = scheduleOnOrAfter(plan, date);
    for (let index = 1; index < count; index++) scheduled = nextOccurrence(plan, scheduled);
    return scheduled <= '2200-12-31' ? scheduled : null;
}

export function scheduleLabel(plan) {
    return plan.frequency === 'daily' ? 'setiap hari' : plan.frequency === 'weekly' ? `setiap ${weekdays[plan.scheduleDay]}` : `setiap tanggal ${plan.scheduleDay}`;
}

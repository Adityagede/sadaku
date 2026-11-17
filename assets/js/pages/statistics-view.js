import { currentCurrency, currencyInfo, moneyDisplay, majorAmount } from '../domain/currency.js';
import { formatMonth, shiftMonth } from '../domain/monthly.js';
import { activityTypeLabel } from '../domain/activity.js';

const shortMoney = { format(value, currency) { return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: Math.max(1, currencyInfo(currency).digits) }).format(value); } };
const percent = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });
const dates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const utcDate = date => new Date(`${date}T00:00:00Z`);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function renderMoneySummary({ deposits, withdrawals }, selected, currency) {
    const metrics = [
        { type: 'deposit', value: deposits, icon: 'in' },
        { type: 'withdrawal', value: withdrawals, icon: 'out' }
    ];
    return metrics.map(({ type, value, icon: direction }) => `<button type="button" class="report-metric report-metric-${type}"
        id="report-type-${type}" data-report-type="${type}" aria-controls="report-breakdown" aria-pressed="${type === selected}">
        <span class="report-metric-icon">${icon(direction)}</span><span class="report-metric-copy">
            <span>${activityTypeLabel(type)}</span><strong>${moneyDisplay.format(value, currency)}</strong>
        </span>
    </button>`).join('');
}

function renderAlbumPicker(albums, selected) {
    if (!albums.length) return '';
    const mixed = new Set(albums.map(album => album.currency || 'IDR')).size > 1;
    const options = albums.map(({ id, name, currency = 'IDR' }) => `<option value="${escapeHtml(id)}"${id === selected ? ' selected' : ''}>${escapeHtml(name)}${mixed ? ' · ' + currency : ''}</option>`).join('');
    return `<label class="report-album"><span>Album</span><select id="report-album"><option value="all">Semua album</option>${options}</select></label>`;
}

function renderBreakdown(entries, albums, type, currency) {
    const totals = new Map();
    for (const entry of entries) {
        if (entry.type === type) totals.set(entry.albumId, (totals.get(entry.albumId) || 0) + entry.amount);
    }
    const names = new Map(albums.map(album => [album.id, album.name]));
    const rows = [...totals].sort((a, b) => b[1] - a[1]).map(([id, total]) => `<li class="report-breakdown-row">
        <span class="report-breakdown-icon">${icon('album')}</span><div>
            <span>${escapeHtml(names.get(id) || 'Album')}</span><strong>${moneyDisplay.format(total, currency)}</strong>
        </div>
    </li>`).join('');
    return `<div id="report-breakdown" aria-labelledby="report-type-${type}">
        ${rows ? `<ul class="report-breakdown-list">${rows}</ul>` : `<p class="report-breakdown-empty">Belum ada ${activityTypeLabel(type).toLowerCase()} pada periode ini.</p>`}
    </div>`;
}

function renderComparison({ kind, percentage, difference, previousMonth, partial, throughDay, previousThroughDay }, month, currency) {
    if (kind === 'insufficient') {
        return `<section class="report-insight"><h3>Perbandingan setoran</h3>
            <p>Belum cukup riwayat untuk membandingkan periode ini.</p></section>`;
    }
    const formattedPercent = percentage === null ? '' : Math.abs(percentage) < 0.01 && percentage !== 0
        ? '&lt;0,01%' : percent.format(Math.abs(percentage)) + '%';
    const titles = {
        increase: `Setoran naik ${formattedPercent}`,
        decrease: `Setoran turun ${formattedPercent}`,
        same: 'Nominal setoran sama',
        started: 'Mulai ada setoran',
        empty: 'Kedua periode belum memiliki setoran'
    };
    const range = partial
        ? `1–${throughDay} ${formatMonth(month)} dan 1–${previousThroughDay} ${formatMonth(previousMonth)}`
        : `${formatMonth(month)} dan ${formatMonth(previousMonth)}`;
    const amount = difference ? ` · Selisih ${difference > 0 ? '+' : '−'}${moneyDisplay.format(Math.abs(difference), currency)}` : '';
    return `<section class="report-insight" data-trend="${kind}"><h3>Perbandingan setoran</h3>
        <strong>${titles[kind]}</strong><p>${range}${amount}</p></section>`;
}

function renderChart({ chart, month, currentMonth, history }, currency) {
    if (!chart.length) {
        return `<section class="report-chart report-chart-waiting">
            <div class="report-width"><h2>Bulan pertamamu masih berjalan</h2>
                <p>Grafik bulanan tersedia mulai ${formatMonth(shiftMonth(currentMonth, 1))}.</p></div>
        </section>`;
    }
    const maximum = Math.max(1, ...chart.map(item => item.deposits));
    const bars = chart.map(item => {
        const height = item.deposits > 0 ? Math.max(3, item.deposits / maximum * 96) : 0;
        const label = shortMonth.format(utcDate(`${item.month}-01`));
        const bar = height
            ? `<rect x="0" y="${100 - height}" width="40" height="${height}" rx="${Math.min(4, height / 2)}"/>`
            : '<line x1="3" y1="99" x2="37" y2="99"/>';
        return `<button type="button" class="report-bar" id="report-bar-${item.month}" data-report-month="${item.month}"
            aria-pressed="${item.month === month}" aria-label="Lihat ${formatMonth(item.month)}, setoran ${moneyDisplay.format(item.deposits, currency)}">
            <span class="report-bar-value" title="${moneyDisplay.format(item.deposits, currency)}">${shortMoney.format(majorAmount(item.deposits, currency), currency)}</span>
            <svg viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true">${bar}</svg>
            <span class="report-bar-month">${label}</span><span class="report-bar-year">${item.month.slice(0, 4)}</span>
        </button>`;
    }).join('');
    return `<section class="report-chart" aria-labelledby="report-chart-title">
        <div class="report-chart-heading report-width">
            <h2 id="report-chart-title">Setoran ${chart.length} bulan selesai${history.completedCount > chart.length ? ' terakhir' : ''}</h2>
            <span>${currency}</span>
        </div>
        <div class="report-chart-plot">
            <svg class="report-chart-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 0H100 M0 25H100 M0 50H100 M0 75H100 M0 100H100" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="month-chart report-width" role="group" aria-label="Pilih bulan selesai dari grafik setoran">${bars}</div>
        </div>
    </section>`;
}

function renderPeriodHeading({ months, month, currentMonth, comparison }) {
    const monthLabel = formatMonth(month);
    const periodEnd = `${month}-${String(comparison.throughDay).padStart(2, '0')}`;
    const dateRange = `<p>${dates.formatRange(utcDate(`${month}-01`), utcDate(periodEnd))}${month === currentMonth ? ' · Bulan berjalan' : ''}</p>`;
    if (months.length < 2) {
        return `<div class="report-sheet-heading"><div><h2 id="report-period-title">${monthLabel}</h2>${dateRange}</div></div>`;
    }
    const monthIndex = months.indexOf(month);
    const controls = [
        { id: 'previous', label: 'Bulan sebelumnya', month: months[monthIndex + 1] },
        { id: 'next', label: 'Bulan berikutnya', month: months[monthIndex - 1] }
    ];
    const buttons = controls.map(control => `<button type="button" class="report-period-step" id="report-${control.id}"
        data-period-month="${control.month === currentMonth ? 'current' : control.month || ''}" aria-label="${control.label}"
        ${control.month ? '' : 'aria-disabled="true"'}>${icon('chevron')}</button>`).join('');
    const options = months.map(key => `<option value="${key === currentMonth ? 'current' : key}"${key === month ? ' selected' : ''}>${formatMonth(key)}</option>`).join('');
    return `<div class="report-sheet-heading">
        <div class="report-period-name">
            <h2 id="report-period-title" class="sr-only">${monthLabel}</h2>
            <div class="report-period-picker"><select id="report-month" aria-label="Periode laporan">${options}</select>${icon('chevron')}</div>
            ${dateRange}
        </div>
        <div class="report-period-controls">${buttons}</div>
    </div>`;
}

export function renderMonthlyReport(report, { albums = [], type = 'deposit', currency = currentCurrency().code } = {}) {
    const { summary, month, comparison, routine, history } = report;
    const albumPicker = renderAlbumPicker(albums, report.albumId);
    if (!history.hasEntries) {
        return `<div class="report-sheet report-width">${albumPicker}
            <div class="statistics-empty"><h2>${report.albumId === 'all' ? 'Statistikmu dimulai dari catatan pertama' : 'Album ini belum punya catatan'}</h2>
                <p>Setoran dan penarikan yang tercatat akan muncul di laporan ini.</p>
                <button type="button" class="button button-outline" data-view="albums">Lihat album${icon('arrow')}</button></div>
        </div>`;
    }
    const routines = routine.observedMonths ? `<section class="report-insight"><h3>Konsistensi menabung</h3>
        <strong>Setoran di ${routine.activeMonths} dari ${routine.observedMonths} bulan selesai${history.completedCount > routine.observedMonths ? ' terakhir' : ''}</strong>
        <p>${routine.streak ? `${routine.streak} bulan berturut-turut dengan setoran hingga bulan lalu.` : 'Belum ada rentetan setoran hingga bulan lalu.'}</p>
    </section>` : '';
    return `${renderChart(report, currency)}
    <section class="report-sheet report-width" aria-labelledby="report-period-title">
        ${renderPeriodHeading(report)}
        ${albumPicker}
        <div class="statistics-metrics" role="group" aria-label="Rincian arus tabungan">${renderMoneySummary(summary, type, currency)}</div>
        ${renderBreakdown(summary.entries, albums, type, currency)}
        <div class="report-net"><span>Tabungan bersih</span><strong>${moneyDisplay.format(summary.net, currency)}</strong></div>
        <div class="report-insights">${renderComparison(comparison, month, currency)}${routines}</div>
        <div class="report-history"><button type="button" class="button button-primary" id="report-history-link" data-action="view-history">Buka Riwayat</button></div>
    </section>`;
}

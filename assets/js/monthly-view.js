import { formatMonth } from './monthly.js';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const shortMoney = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });

export function renderMoneySummary(summary, withIcons = false) {
    const metrics = [
        { label: 'Setoran', value: summary.deposits, name: 'deposit', icon: 'in' },
        { label: 'Penarikan', value: summary.withdrawals, name: 'withdrawal', icon: 'out' },
        { label: 'Tabungan bersih', value: summary.net, name: 'net', icon: 'wallet' }
    ];
    return metrics.map(metric => `<div class="period-metric ${metric.name}-metric"><span>${metric.label}</span>
        ${withIcons ? `<span class="metric-symbol" aria-hidden="true"><svg class="icon"><use href="#i-${metric.icon}"/></svg></span>` : ''}
        <strong>${rupiah.format(metric.value)}</strong></div>`).join('');
}

function renderComparison(comparison, month) {
    const { kind, percentage, difference, previousMonth, partial, throughDay, previousThroughDay } = comparison;
    const formattedPercent = percentage === null ? '' : Math.abs(percentage) < 0.01 && percentage !== 0
        ? '<0,01%' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Math.abs(percentage)) + '%';
    const titles = {
        increase: `Setoran naik ${formattedPercent}`,
        decrease: `Setoran turun ${formattedPercent}`,
        same: 'Nominal setoran sama',
        started: 'Mulai ada setoran',
        empty: 'Belum ada setoran di kedua periode',
        insufficient: 'Belum ada catatan pembanding'
    };
    const range = partial
        ? `Tanggal 1–${throughDay} ${formatMonth(month)} dibandingkan tanggal 1–${previousThroughDay} ${formatMonth(previousMonth)}.`
        : `${formatMonth(month)} dibandingkan ${formatMonth(previousMonth)}, masing-masing satu bulan penuh.`;
    const amount = kind === 'insufficient' ? 'Perbandingan muncul setelah ada riwayat pada periode sebelumnya.'
        : kind === 'empty' ? 'Kedua periode belum memiliki setoran tercatat.'
        : `Selisih ${difference > 0 ? '+' : difference < 0 ? '−' : ''}${rupiah.format(Math.abs(difference))} dari periode sebelumnya.`;
    return `<div class="comparison-box" data-trend="${kind}"><p class="eyebrow">PERBANDINGAN SETORAN</p><h3>${titles[kind].replace('<', '&lt;')}</h3><p>${amount}</p><span>${range}</span></div>`;
}

export function renderMonthlyReport(report) {
    const { summary, chart, month, currentMonth, comparison, routine } = report;
    const maximum = Math.max(1, ...chart.map(item => item.deposits));
    const bars = chart.map(item => {
        const height = item.deposits > 0 ? Math.max(3, item.deposits / maximum * 116) : 0;
        const label = shortMonth.format(new Date(`${item.month}-01T00:00:00Z`));
        return `<button type="button" class="month-bar${item.month === currentMonth ? ' is-current' : ''}" data-report-month="${item.month}"
            aria-pressed="${item.month === month}" aria-label="Lihat ${formatMonth(item.month)}: setoran ${rupiah.format(item.deposits)}">
            <span class="chart-value" title="${rupiah.format(item.deposits)}">${shortMoney.format(item.deposits)}</span>
            <svg viewBox="0 0 40 126" preserveAspectRatio="none" aria-hidden="true"><rect class="bar-track" x="5" y="4" width="30" height="116" rx="6"/>
                <rect class="bar-fill" x="5" y="${120 - height}" width="30" height="${height}" rx="${Math.min(6, height / 2)}"/></svg>
            <span class="chart-month">${label}</span><span class="chart-year">${item.month.slice(0, 4)}</span></button>`;
    }).join('');
    const routineText = routine.observedMonths
        ? `Setoran tercatat pada <strong>${routine.activeMonths} dari ${routine.observedMonths} bulan selesai</strong> terakhir.`
        : 'Belum ada bulan selesai dalam riwayatmu.';
    const streakText = routine.streak > 0 ? `Setoran tercatat selama <strong>${routine.streak} bulan berturut-turut</strong>.`
        : 'Belum ada setoran tercatat pada bulan ini dan bulan lalu.';
    return `<div class="statistics-period-heading"><div><p class="eyebrow">PERIODE TERPILIH</p><h2>${formatMonth(month, currentMonth)}</h2></div><div class="period-badges"><span class="period-state">${month === currentMonth ? 'Masih berjalan' : 'Bulan selesai'}</span><span class="count-badge">${summary.count} catatan</span></div></div>
        <div class="statistics-metrics">${renderMoneySummary(summary, true)}</div>
        <div class="report-surface">
        <div class="report-body"><div class="savings-chart"><div class="chart-heading"><div><p class="eyebrow">PERKEMBANGAN</p><h3>Setoran 6 bulan terakhir</h3></div><span>Rupiah</span></div>
            <div class="month-chart" role="group" aria-label="Pilih bulan dari grafik setoran">${bars}</div>
            <p class="chart-help">${chart.some(item => item.deposits > 0) ? 'Tekan batang untuk melihat rincian bulan tersebut.' : 'Belum ada setoran tercatat dalam enam bulan terakhir.'} Bulan ini masih berjalan.</p></div>
            ${renderComparison(comparison, month)}</div>
        <div class="routine-box"><div><h3>Rutinitas menabung</h3><p>${routineText}</p></div><div><p>${streakText}</p><span>${routine.enoughHistory ? 'Rutinitas dihitung dari adanya setoran, bukan besar nominalnya. Bulan berjalan tidak dihitung sebagai bulan selesai.' : 'Pola rutinitas akan lebih jelas setelah ada riwayat dari dua bulan yang sudah selesai. Bulan berjalan tidak dihitung sebagai bulan selesai.'}</span></div></div>
        <div class="statistics-report-footer"><div><h3>Catatan pada periode ini</h3><p>Buka rincian setoran dan penarikan di Riwayat.</p></div><button type="button" class="button button-primary" data-action="view-statistics-history">Lihat catatan periode ini<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button></div>
    </div>`;
}

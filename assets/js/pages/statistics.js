import { $ } from '../components/dom.js';
import { today } from '../domain/dates.js';
import { currencyGroups, albumCurrency, currencyInfo } from '../domain/currency.js';
import { createMonthlyReport, formatMonth, resolveMonth } from '../domain/monthly.js';
import { renderMonthlyReport } from './statistics-view.js';

export function createStatisticsPage({ getData, ui }) {
    let monthlyReportMarkup = '';
    let monthlyReportType = 'deposit';
    let statisticsCurrency = null;
    function renderStatistics() {
        const data = getData();
        const date = today();
        if (ui.statistics.albumId !== 'all' && !data.albums.some(album => album.id === ui.statistics.albumId)) ui.statistics.albumId = 'all';
        const groups = currencyGroups(data.albums);
        const selectedAlbum = data.albums.find(album => album.id === ui.statistics.albumId);
        if (selectedAlbum) statisticsCurrency = selectedAlbum.currency;
        if (!groups.includes(statisticsCurrency)) statisticsCurrency = groups[0] || 'IDR';
        const entries = data.entries.filter(entry => albumCurrency(data.albums, entry.albumId) === statisticsCurrency);
        const report = createMonthlyReport(entries, ui.statistics.period, date, ui.statistics.albumId);
        if (resolveMonth(ui.statistics.period, date) !== report.month) ui.statistics.period = 'current';
        const currencyPicker = groups.length > 1 ? '<div class="report-width report-currency"><label for="report-currency">Mata uang</label><select id="report-currency">' + groups.map(code => '<option value="' + code + '"' + (code === statisticsCurrency ? ' selected' : '') + '>' + code + ' — ' + currencyInfo(code).name + '</option>').join('') + '</select><p>Total dan grafik mengikuti mata uang yang dipilih.</p></div>' : '';
        const markup = currencyPicker + renderMonthlyReport(report, {
            albums: data.albums,
            type: monthlyReportType,
            currency: statisticsCurrency
        });
        if (markup !== monthlyReportMarkup) {
            const container = $('#monthly-report');
            const focused = container.contains(document.activeElement) && document.activeElement.id;
            container.innerHTML = markup;
            monthlyReportMarkup = markup;
            if (focused) (document.getElementById(focused) || $('#statistics-title')).focus({ preventScroll: true });
        }
    }

    function updatePeriodSelection() {
        const data = getData();
        renderStatistics();
        const selection = ui.statistics.period;
        const albumId = ui.statistics.albumId;
        const album = data.albums.find(item => item.id === albumId);
        $('#period-announcement').textContent = `Menampilkan ${formatMonth(resolveMonth(selection, today()), today().slice(0, 7))}, ${album?.name || 'semua album'}.`;
    }

    $('#monthly-report').addEventListener('change', event => {
        if (event.target.id === 'report-currency') {
            statisticsCurrency = event.target.value;
            ui.statistics.albumId = 'all';
            updatePeriodSelection();
            return;
        }
        const key = { 'report-album': 'albumId', 'report-month': 'period' }[event.target.id];
        if (!key) return;
        ui.statistics[key] = event.target.value;
        updatePeriodSelection();
    });


    return { renderStatistics, updatePeriodSelection, invalidate() { monthlyReportMarkup = ''; }, selectType(type) { monthlyReportType = type; renderStatistics(); } };
}

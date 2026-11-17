import { $, escapeHtml } from '../components/dom.js';
import { today } from '../domain/dates.js';
import { ACTIVITY_PAGE_SIZE, filterActivity, activityCsv } from '../domain/activity.js';
import { formatMonth } from '../domain/monthly.js';

export function createHistoryPage({ getData, ui, openDialog, renderActivityList }) {

    function updateAlbumControl(id, scope) {
        const data = getData();
        if (scope.albumId !== 'all' && !data.albums.some(album => album.id === scope.albumId)) scope.albumId = 'all';
        const control = $(`#${id}`);
        control.innerHTML = '<option value="all">Semua album</option>' + data.albums.map(album =>
            `<option value="${album.id}">${escapeHtml(album.name)}</option>`
        ).join('');
        control.value = scope.albumId;
    }

    function renderHistory() {
        const data = getData();
        const filters = ui.history;
        if (filters.albumId !== 'all' && !data.albums.some(album => album.id === filters.albumId)) filters.albumId = 'all';
        if (filters.month !== 'all' && !data.entries.some(entry => entry.date.startsWith(filters.month))) filters.month = 'all';
        const matches = filterActivity(data.entries, data.albums, filters);
        const activeFilters = [filters.month, filters.albumId, filters.type].filter(value => value !== 'all').length;
        const filtered = activeFilters > 0 || Boolean(filters.query.trim());
        const filterButton = $('#history-filter');
        filterButton.toggleAttribute('data-active', activeFilters > 0);
        filterButton.setAttribute('aria-label', activeFilters ? `Filter aktivitas, ${activeFilters} aktif` : 'Filter aktivitas');
        $('#history-export').disabled = !matches.length;
        $('#history-results').textContent = filtered ? `${matches.length} aktivitas ditemukan.` : '';
        $('#history-load-more').hidden = !renderActivityList('#all-entries', matches, ui.historyLimit);
        if (!matches.length) {
            $('#all-entries').innerHTML = filtered
                ? '<div class="history-empty"><h2>Aktivitas tidak ditemukan</h2><button type="button" class="text-button" data-action="reset-history">Reset pencarian dan filter</button></div>'
                : '<div class="history-empty"><h2>Belum ada aktivitas</h2><p>Setoran dan penarikan yang tercatat akan muncul di sini.</p></div>';
        }
    }

    function setHistoryFilters(filters) {
        ui.history = { ...ui.history, ...filters };
        ui.historyLimit = ACTIVITY_PAGE_SIZE;
        $('#history-query').value = ui.history.query;
        renderHistory();
    }

    function openHistoryFilter() {
        const data = getData();
        const months = [...new Set(data.entries.map(entry => entry.date.slice(0, 7)))].sort().reverse();
        const monthControl = $('#history-month');
        monthControl.innerHTML = '<option value="all">Semua bulan</option>' + months.map(month =>
            `<option value="${month}">${formatMonth(month)}</option>`
        ).join('');
        monthControl.value = ui.history.month;
        updateAlbumControl('history-album', ui.history);
        $('#history-type').value = ui.history.type;
        openDialog($('#history-filter-dialog'));
    }

    function exportHistory() {
        const data = getData();
        const entries = filterActivity(data.entries, data.albums, ui.history);
        if (!entries.length) return;
        const url = URL.createObjectURL(new Blob([activityCsv(entries, data.albums)], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `aktivitas-sadaku-${today()}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    $('#history-query').addEventListener('input', event => {
        ui.history.query = event.target.value;
        ui.historyLimit = ACTIVITY_PAGE_SIZE;
        renderHistory();
    });
    $('#history-filter-form').addEventListener('submit', event => {
        event.preventDefault();
        setHistoryFilters(Object.fromEntries(new FormData(event.target)));
        $('#history-filter-dialog').close();
    });


    return { renderHistory, setHistoryFilters, openHistoryFilter, exportHistory };
}

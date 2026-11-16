import { calculateProgress, formatProgress } from './progress.js';
import { createMonthlyReport, formatMonth, resolveMonth, summarizeMonth } from './monthly.js';
import { renderMonthlyReport } from './monthly-view.js';
import { applyRoute, createNavigationState, parseRoute, routeFor } from './navigation.js';
import { estimatedCompletion, nextPlanDate, periodDeposits, scheduleLabel, suggestedAmount, weekdays } from './saving-plan.js';
import { createDeviceNotifications } from './reminders.js';
import { bindMoneyInputs, moneyFormData, rawMoney, setMoneyValue } from './money-input.js';
import { ACTIVITY_PAGE_SIZE, DEFAULT_ACTIVITY_FILTERS, activityCsv, activityDayLabel, activityMonths, activityPage, activityTypeLabel, bindActivityMotion, filterActivity } from './activity.js';
import { entryDestination } from './entry-context.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const activityDates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const historyDates = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatActivityDate = date => activityDates.format(new Date(`${date}T00:00:00Z`));
const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const ui = createNavigationState();
let data = { albums: [], entries: [], csrf: '', settings: {} };
let pendingDelete = null;
let previewUrl = null;
let toastTimer;
let lastDialogOpener;
let monthlyReportMarkup = '';
let monthlyReportType = 'deposit';
const deviceNotifications = createDeviceNotifications({ request, changed: renderDeviceSettings });
bindMoneyInputs(document);
bindActivityMotion(document);
if ('ResizeObserver' in window) {
    new ResizeObserver(([entry]) => {
        document.documentElement.style.setProperty('--mobile-nav-height', `${entry.target.getBoundingClientRect().height}px`);
    }).observe($('.sidebar'));
}

function today() {
    const parts = Object.fromEntries(todayParts.formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(value) {
    if (!value) return 'Tanpa batas waktu';
    const [year, month, day] = value.split('-').map(Number);
    return dates.format(new Date(year, month - 1, day));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function icon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function imageUrl(album) {
    return album.imageVersion
        ? `php/api.php?action=image&id=${encodeURIComponent(album.id)}&v=${encodeURIComponent(album.imageVersion)}`
        : 'assets/images/album-cover.svg';
}

function progress(album) {
    return calculateProgress(album.balance, album.target);
}

function renderProgress(album) {
    const value = progress(album);
    const label = formatProgress(value);
    return `<progress class="progress-track${value > 0 ? ' has-progress' : ''}${value === 100 ? ' is-complete' : ''}"
        value="${value}" max="100"
        aria-label="Progres ${escapeHtml(album.name)}"
        aria-valuetext="${escapeHtml(label)}; ${rupiah.format(album.balance)} dari ${rupiah.format(album.target)}">${escapeHtml(label)}</progress>`;
}

function deadlineText(album) {
    if (album.balance >= album.target) return 'Target tercapai';
    if (!album.deadline) return 'Sesuai ritmemu';
    const days = Math.round((Date.parse(album.deadline) - Date.parse(today())) / 86400000);
    if (days < 0) return 'Lewat tanggal target';
    if (days === 0) return 'Target hari ini';
    return `${days.toLocaleString('id-ID')} hari menuju target`;
}

function albumCover(album, className = 'album-cover') {
    return `<div class="${className} ${album.imageVersion ? '' : 'is-default'}" data-color="${escapeHtml(album.color)}">
        <img src="${escapeHtml(imageUrl(album))}" alt="" loading="lazy">
        ${album.imageVersion ? '' : `<span class="cover-initial" aria-hidden="true">${escapeHtml(Array.from(album.name)[0].toUpperCase())}</span>`}
    </div>`;
}

async function request(action = 'state', body = null) {
    let response;
    try {
        response = await fetch(`php/api.php?action=${action}`, {
            method: body ? 'POST' : 'GET',
            credentials: 'same-origin',
            headers: body ? { 'X-CSRF-Token': data.csrf } : {},
            body
        });
    } catch {
        throw new Error(location.protocol === 'file:'
            ? 'Buka aplikasi melalui server PHP. Jalankan npm run dev, lalu buka http://127.0.0.1:8080.'
            : 'Koneksi ke server terputus. Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.');
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error('Respons server tidak dapat dibaca. Pastikan Sadaku dijalankan melalui PHP.');
    }
    if (!response.ok) throw new Error(result.error || 'Data belum dapat diproses.');
    return result;
}

function acceptSnapshot(result) {
    data = { albums: result.albums, entries: result.entries, csrf: result.csrf || data.csrf, settings: result.settings || data.settings };
    renderSettings();
    render();
    if (result.push) deviceNotifications.refresh(result.push);
}

function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}

function readRoute() {
    applyRoute(ui, parseRoute(location.hash));
}

function navigate(view, albumId = null, focus = true) {
    applyRoute(ui, { view, albumId });
    const route = routeFor(view, albumId);
    if (location.hash !== `#${route}`) history.pushState(null, '', `#${route}`);
    renderView();
    renderDetail();
    if (focus) {
        const heading = view === 'detail' ? $('#detail-title') : $({ overview: '#overview-title', albums: '#albums-title', history: '#history-title', statistics: '#statistics-title', settings: '#settings-title' }[view]);
        heading?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
}

function renderView() {
    if (ui.view === 'detail' && !data.albums.some(album => album.id === ui.albumId)) {
        ui.view = 'albums';
        ui.albumId = null;
        history.replaceState(null, '', '#album');
    }
    $('#overview-view').hidden = ui.view !== 'overview';
    $('#albums-view').hidden = !['overview', 'albums'].includes(ui.view);
    $('#recent-view').hidden = ui.view !== 'overview';
    $('#statistics-view').hidden = ui.view !== 'statistics';
    $('#detail-view').hidden = ui.view !== 'detail';
    $('#history-view').hidden = ui.view !== 'history';
    $('#settings-view').hidden = ui.view !== 'settings';
    $('#application').hidden = !data.csrf || ui.view === 'settings';
    const canCreateFromView = ['history', 'statistics'].includes(ui.view)
        || (data.albums.length > 0 && ['overview', 'albums'].includes(ui.view));
    $('#album-create-fab').hidden = !data.csrf || !canCreateFromView;
    $('.settings-trigger').classList.toggle('is-active', ui.view === 'settings');
    if (ui.view === 'settings') $('.settings-trigger').setAttribute('aria-current', 'page');
    else $('.settings-trigger').removeAttribute('aria-current');
    $('#header-location').textContent = ({ overview: 'Ruang tabunganmu', albums: 'Album target', detail: 'Album target / Detail', history: 'Riwayat uangmu', statistics: 'Statistik tabungan', settings: 'Pengaturan' })[ui.view];
    $('.app-navigation').querySelectorAll('[data-view]').forEach(button => {
        const active = button.dataset.view === (ui.view === 'detail' ? 'albums' : ui.view);
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
}

function renderSummary() {
    const total = data.albums.reduce((sum, album) => sum + album.balance, 0);
    const completed = data.albums.filter(album => album.balance >= album.target).length;
    const month = today().slice(0, 7);
    const monthly = summarizeMonth(data.entries, month);
    $('#total-balance').textContent = rupiah.format(total);
    $('#active-count').innerHTML = `${data.albums.length - completed}<span>album</span>`;
    $('#completed-count').innerHTML = `${completed}<span>album</span>`;
    $('#nav-album-count').textContent = data.albums.length;
    $('#filter-count').textContent = data.albums.length;
    $('#monthly-summary').textContent = monthly.count
        ? `${rupiah.format(Math.abs(monthly.net))} ${monthly.net < 0 ? 'penarikan' : 'setoran'} bersih bulan ini`
        : 'Belum ada setoran bulan ini';
}

function updateAlbumControl(id, scope) {
    if (scope.albumId !== 'all' && !data.albums.some(album => album.id === scope.albumId)) scope.albumId = 'all';
    const control = $(`#${id}`);
    control.innerHTML = '<option value="all">Semua album</option>' + data.albums.map(album =>
        `<option value="${album.id}">${escapeHtml(album.name)}</option>`
    ).join('');
    control.value = scope.albumId;
}

function renderStatistics() {
    const date = today();
    if (ui.statistics.albumId !== 'all' && !data.albums.some(album => album.id === ui.statistics.albumId)) ui.statistics.albumId = 'all';
    const report = createMonthlyReport(data.entries, ui.statistics.period, date, ui.statistics.albumId);
    if (resolveMonth(ui.statistics.period, date) !== report.month) ui.statistics.period = 'current';
    const markup = renderMonthlyReport(report, {
        albums: data.entries.length ? data.albums : [],
        type: monthlyReportType
    });
    if (markup !== monthlyReportMarkup) {
        const container = $('#monthly-report');
        const focused = container.contains(document.activeElement) && document.activeElement.id;
        container.innerHTML = markup;
        monthlyReportMarkup = markup;
        if (focused) (document.getElementById(focused) || $('#statistics-title')).focus({ preventScroll: true });
    }
}

function renderHistory() {
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

function renderActivityList(selector, entries, limit, inAlbum = false) {
    const feed = $(selector);
    const expanded = new Set([...feed.querySelectorAll('details[open]')].map(item => item.dataset.entryId));
    const page = activityPage(entries, limit);
    if (!page.days.length) {
        if (inAlbum) feed.innerHTML = renderEntries([], 'Belum ada aktivitas.', 'Setoran dan penarikan album ini akan muncul di sini.');
        return false;
    }
    const dateToday = today();
    const renderRows = items => items.map(entry => renderActivity(entry, expanded.has(entry.id), inAlbum)).join('');
    if (inAlbum) {
        feed.innerHTML = page.days.map(({ date, entries }) => `<section class="activity-day" aria-labelledby="${feed.id}-date-${date}">
            <h3 id="${feed.id}-date-${date}" class="activity-day-label"><time datetime="${date}">${activityDayLabel(date, dateToday, formatActivityDate)}</time></h3>
            <div class="activity-day-items">${renderRows(entries)}</div>
        </section>`).join('');
    } else {
        feed.innerHTML = [...activityMonths(page.days)].map(([month, items]) => `<section class="history-month" aria-labelledby="activity-${month}">
            <div class="history-month-heading"><h2 id="activity-${month}">${month === dateToday.slice(0, 7) ? 'Bulan ini' : formatMonth(month)}</h2>
                <button type="button" class="history-month-report" data-action="history-report" data-month="${month}" aria-label="Laporan ${formatMonth(month)}">Laporan<span>${icon('chevron')}</span></button></div>
            ${renderRows(items)}
        </section>`).join('');
    }
    return page.hasMore;
}

function renderActivity(entry, expanded, inAlbum = false) {
    const album = data.albums.find(item => item.id === entry.albumId);
    const withdrawal = entry.type === 'withdrawal';
    const type = activityTypeLabel(entry.type);
    const title = entry.note || type;
    const albumName = escapeHtml(album?.name || 'Album');
    const date = historyDates.format(new Date(`${entry.date}T00:00:00Z`));
    const description = inAlbum
        ? (entry.note ? type : '')
        : `<time datetime="${entry.date}">${date}</time> · ${albumName}`;
    return `<details class="activity-item" data-entry-id="${entry.id}"${expanded ? ' open' : ''}>
        <summary class="activity-row">
            <span class="activity-direction${withdrawal ? ' is-withdrawal' : ''}">${icon(withdrawal ? 'out' : 'in')}</span>
            <span class="activity-copy"><span class="activity-title">${escapeHtml(title)}</span>${description ? `<span class="activity-album">${description}</span>` : ''}</span>
            <span class="activity-amount${withdrawal ? ' is-withdrawal' : ''}">${withdrawal ? '−' : '+'}${rupiah.format(entry.amount).replace(/\s/g, inAlbum ? ' ' : '')}</span>
            ${inAlbum ? `<span class="activity-chevron">${icon('chevron')}</span>` : `<span class="history-entry-type${withdrawal ? ' is-withdrawal' : ''}">${type}</span>`}
        </summary>
        <div class="activity-detail"><dl><div><dt>Album</dt><dd>${albumName}</dd></div><div><dt>Tanggal</dt><dd><time datetime="${entry.date}">${formatActivityDate(entry.date)}</time></dd></div>${entry.note ? `<div><dt>Catatan</dt><dd>${escapeHtml(entry.note)}</dd></div>` : ''}</dl><div class="activity-detail-actions"><button type="button" class="text-button" data-action="edit-entry" data-id="${entry.id}" aria-label="Ubah catatan ${escapeHtml(title)}">${icon('edit')}Ubah catatan</button><button type="button" class="text-button activity-delete" data-action="delete-entry" data-id="${entry.id}" aria-label="Hapus catatan ${escapeHtml(title)}">${icon('trash')}Hapus</button></div></div>
    </details>`;
}

function renderRecent() {
    const month = today().slice(0, 7);
    const summary = summarizeMonth(data.entries, month);
    $('#recent-title').textContent = 'Catatan bulan ini';
    $('#recent-entries').innerHTML = renderEntries(summary.entries.slice(0, 5), `Belum ada catatan untuk ${formatMonth(month)}.`, 'Tambahkan catatan uang atau buka Riwayat untuk melihat bulan sebelumnya.');
}

function renderPeriods() {
    renderStatistics();
    renderHistory();
    renderRecent();
}

function updatePeriodSelection() {
    renderStatistics();
    const selection = ui.statistics.period;
    const albumId = ui.statistics.albumId;
    const album = data.albums.find(item => item.id === albumId);
    $('#period-announcement').textContent = `Menampilkan ${formatMonth(resolveMonth(selection, today()), today().slice(0, 7))}, ${album?.name || 'semua album'}.`;
}

function renderMotivation() {
    const ongoing = data.albums.filter(album => album.balance < album.target);
    const featured = [...ongoing].sort((a, b) => b.balance / b.target - a.balance / a.target)[0] || data.albums[0];
    const sidebar = $('#sidebar-goal');
    sidebar.hidden = false;

    if (!featured) {
        sidebar.innerHTML = `<p class="sidebar-goal-label">Target berikutnya</p><p class="sidebar-goal-title">Mulai dari satu album.</p><p class="sidebar-goal-description">Tentukan sesuatu yang ingin kamu capai.</p><button class="text-button" type="button" data-action="new-album">Buat album ${icon('arrow')}</button>`;
        $('#motivation-panel').innerHTML = `<div class="motivation-copy"><p class="eyebrow">MULAI MENABUNG</p><h2>Apa yang sedang<br>kamu <em>usahakan?</em></h2><p>Beri nama targetmu, pilih foto, lalu tentukan nominal yang ingin dikumpulkan.</p><button class="text-button" type="button" data-action="new-album">Buat album pertama ${icon('arrow')}</button></div><div class="motivation-art"><img src="assets/images/album-cover.svg" alt=""></div>`;
        return;
    }

    const finished = featured.balance >= featured.target;
    const remaining = Math.max(0, featured.target - featured.balance);
    const label = formatProgress(progress(featured));
    sidebar.innerHTML = `<p class="sidebar-goal-label">${finished ? 'Target tercapai' : 'Target berikutnya'}</p><p class="sidebar-goal-title" title="${escapeHtml(featured.name)}">${escapeHtml(featured.name)}</p>${renderProgress(featured)}<p class="sidebar-goal-description">${escapeHtml(label)} terkumpul</p><button type="button" class="text-button" data-action="open-album" data-id="${featured.id}">Lihat album ${icon('arrow')}</button>`;
    $('#motivation-panel').innerHTML = `<div class="motivation-copy"><p class="eyebrow">${finished ? 'TARGET TERCAPAI' : 'TUJUAN YANG PALING DEKAT'}</p><h2>${escapeHtml(featured.name)}</h2><p>${escapeHtml(featured.motivation || (finished ? 'Nominal yang kamu kumpulkan sudah mencapai target album ini.' : `Masih ${rupiah.format(remaining)} lagi menuju targetmu.`))}</p><div class="motivation-actions"><button type="button" class="text-button" data-action="open-album" data-id="${featured.id}">Buka album ${icon('arrow')}</button><span class="motivation-progress">${escapeHtml(label)} terkumpul</span></div></div><div class="motivation-art ${featured.imageVersion ? 'is-photo' : ''}"><img src="${escapeHtml(imageUrl(featured))}" alt=""></div>`;
}

function renderAlbums() {
    const visible = data.albums.filter(album => {
        const completed = album.balance >= album.target;
        return (ui.filter === 'all' || (ui.filter === 'completed' ? completed : !completed))
            && album.name.toLocaleLowerCase('id-ID').includes(ui.search.toLocaleLowerCase('id-ID'));
    });
    if (!visible.length) {
        $('#album-grid').innerHTML = data.albums.length
            ? '<div class="empty-albums"><h3>Belum ada album yang cocok.</h3><p>Coba nama lain atau pilih status Semua.</p></div>'
            : `<div class="empty-albums"><div class="empty-album-art"><img src="assets/images/album-cover.svg" alt=""></div><h3>Belum ada album target.</h3><p>Buat album dengan nama, foto, dan nominal targetmu sendiri. Misalnya “Target sepeda motor” atau “iPhone 17 Pro Max”.</p><button type="button" class="button button-primary" data-action="new-album">${icon('plus')}Buat album pertama</button></div>`;
        return;
    }
    $('#album-grid').innerHTML = visible.map(album => `<article class="album-card">
        <button type="button" class="album-open" data-action="open-album" data-id="${album.id}" aria-label="Buka album ${escapeHtml(album.name)}">
            <div class="relative">${albumCover(album)}<span class="album-tag">${album.balance >= album.target ? '✓ Tercapai' : 'Berjalan'}</span></div>
            <div class="album-card-body"><h3>${escapeHtml(album.name)}</h3><p class="album-reason">${escapeHtml(album.motivation || 'Tabungan pribadi')}</p><div class="album-amounts">${rupiah.format(album.balance)}<span>dari ${rupiah.format(album.target)}</span></div>${renderProgress(album)}<div class="album-progress-text"><strong>${escapeHtml(formatProgress(progress(album)))} terkumpul</strong><span>${deadlineText(album)}</span></div></div>
        </button>
        <div class="album-card-footer"><button class="text-button" type="button" data-action="new-entry" data-id="${album.id}">${icon('plus')}Catat uang</button><div class="flex"><button class="icon-button" type="button" data-action="edit-album" data-id="${album.id}" aria-label="Ubah album ${escapeHtml(album.name)}">${icon('edit')}</button><button class="icon-button" type="button" data-action="delete-album" data-id="${album.id}" aria-label="Hapus album ${escapeHtml(album.name)}">${icon('trash')}</button></div></div>
    </article>`).join('');
}

function renderEntries(entries, emptyTitle = 'Belum ada catatan uang.', emptyDescription = 'Setelah membuat album, tambahkan setoran pertamamu. Setiap catatan akan terlihat di sini.') {
    if (!entries.length) return `<div class="empty-entries">${icon('history')}<strong class="text-sm font-medium">${escapeHtml(emptyTitle)}</strong><p>${escapeHtml(emptyDescription)}</p></div>`;
    return entries.map(entry => {
        const album = data.albums.find(item => item.id === entry.albumId);
        const withdrawal = entry.type === 'withdrawal';
        const title = entry.note || (withdrawal ? 'Penarikan tabungan' : 'Setoran tabungan');
        return `<article class="entry-row"><span class="entry-direction ${withdrawal ? 'is-withdrawal' : ''}">${icon(withdrawal ? 'out' : 'in')}</span><div class="entry-info"><h3 title="${escapeHtml(title)}">${escapeHtml(title)}</h3><p>${escapeHtml(album?.name || 'Album')} · ${withdrawal ? 'Penarikan' : 'Setoran'}</p></div><div class="entry-amount ${withdrawal ? 'is-withdrawal' : ''}">${withdrawal ? '−' : '+'}${rupiah.format(entry.amount)}<time datetime="${entry.date}">${formatDate(entry.date)}</time></div><div class="entry-actions"><button class="icon-button" type="button" data-action="edit-entry" data-id="${entry.id}" aria-label="Ubah catatan ${escapeHtml(title)}">${icon('edit')}</button><button class="icon-button" type="button" data-action="delete-entry" data-id="${entry.id}" aria-label="Hapus catatan ${escapeHtml(title)}">${icon('trash')}</button></div></article>`;
    }).join('');
}

function renderDetail() {
    if (ui.view !== 'detail') return;
    const album = data.albums.find(item => item.id === ui.albumId);
    if (!album) return;
    const remaining = Math.max(0, album.target - album.balance);
    const entries = data.entries.filter(entry => entry.albumId === album.id);
    $('#album-detail').innerHTML = `<div class="detail-toolbar"><button type="button" class="text-button" data-view="albums">${icon('back')}Kembali</button><div class="album-edit-actions"><button type="button" class="button button-outline" data-action="edit-album" data-id="${album.id}">${icon('edit')}Ubah album</button><button type="button" class="icon-button" data-action="delete-album" data-id="${album.id}" aria-label="Hapus album ${escapeHtml(album.name)}">${icon('trash')}</button></div></div>
        <div class="detail-layout album-focus">${albumCover(album, 'detail-cover')}<div class="detail-copy"><p class="eyebrow">${remaining ? 'TABUNGAN BERJALAN' : 'TARGET TERCAPAI'}</p><h1 id="detail-title" tabindex="-1">${escapeHtml(album.name)}</h1>${album.motivation ? `<p class="detail-motivation">${escapeHtml(album.motivation)}</p>` : ''}
        <div class="album-balance"><span>Saldo album</span><p class="detail-saved">${rupiah.format(album.balance)}</p><p class="detail-target">dari target ${rupiah.format(album.target)}</p></div>${renderProgress(album)}<div class="album-progress-text"><strong>${escapeHtml(formatProgress(progress(album)))} tercapai</strong></div>
        <div class="detail-metrics"><div><p>Sisa target</p><strong>${remaining ? rupiah.format(remaining) : 'Sudah tercapai'}</strong></div>${album.deadline ? `<div><p>Target tanggal</p><strong>${formatDate(album.deadline)}</strong></div>` : ''}</div>
        <button type="button" class="button button-primary album-entry-cta" data-action="new-entry" data-id="${album.id}">${icon('plus')}Catat uang</button></div></div>`;
    renderPlan(album);
    $('#detail-count').textContent = `${entries.length} aktivitas`;
    $('#detail-load-more').hidden = !renderActivityList('#detail-entries', entries, ui.detailLimit, true);
}

function render() {
    renderSummary();
    renderMotivation();
    renderAlbums();
    renderPeriods();
    renderView();
    renderDetail();
}

function renderPlan(album) {
    const plan = album.plan;
    if (!plan) { $('#album-plan').innerHTML = ''; return; }
    const completed = album.balance >= album.target;
    const total = periodDeposits(plan, data.entries, album.id, today());
    const next = nextPlanDate(plan, data.entries, album.id, today());
    const active = !completed && !plan.paused;
    const reminder = completed ? 'Pengingat berhenti karena target tercapai.' : plan.paused ? 'Pengingat dijeda.' : !plan.reminderEnabled ? 'Pengingat dimatikan.' : `Pengingat pukul ${plan.reminderTime} WIB.${deviceNotifications.status().active ? '' : ' Notifikasi perangkat ini belum aktif.'}`;
    $('#album-plan').innerHTML = `<section class="saving-plan" aria-labelledby="album-plan-title"><div class="plan-heading"><div><p class="eyebrow">RENCANA MENABUNG</p><h2 id="album-plan-title">${rupiah.format(plan.amount)} <span>${escapeHtml(scheduleLabel(plan))}</span></h2></div><span class="plan-status">${completed ? 'Tercapai' : plan.paused ? 'Dijeda' : 'Aktif'}</span></div><div class="plan-overview"><div><p>${active ? 'Jadwal berikutnya' : 'Mulai menabung'}</p><strong>${formatDate(active ? next : plan.startDate)}</strong></div><div><p>Setoran periode ini</p><strong>${rupiah.format(total)} <span>/ ${rupiah.format(plan.amount)}</span></strong></div></div><p class="plan-reminder">${icon('bell')}${escapeHtml(reminder)}</p></section>`;
}

function readAlbumPlan() {
    const form = $('#album-form');
    return { frequency: form.elements.plan_frequency.value, amount: Number(rawMoney(form.elements.plan_amount.value)), startDate: form.elements.plan_start_date.value, scheduleDay: Number(form.elements.plan_schedule_day.value || 1) };
}

function refreshAlbumPlan(resetDay = false) {
    const form = $('#album-form');
    const frequency = form.elements.plan_frequency.value;
    const enabled = Boolean(frequency);
    $('#album-plan-fields').hidden = !enabled;
    $('#album-plan-fields').disabled = !enabled;
    $('#clear-album-plan').hidden = !enabled;
    $('#album-plan-choice-help').hidden = enabled;
    $('#album-plan-pause-field').hidden = !form.elements.id.value;
    const reminder = form.elements.plan_reminder_enabled.checked;
    $('#album-reminder-fields').hidden = !reminder;
    $('#album-reminder-fields').disabled = !reminder;
    $('#album-plan-reminder').setAttribute('aria-expanded', String(reminder));
    if (!enabled) return;
    if (resetDay) {
        $('#album-plan-day').innerHTML = frequency === 'weekly' ? weekdays.map((name, day) => `<option value="${day}">${name}</option>`).join('') : Array.from({ length: 31 }, (_, day) => `<option value="${day + 1}">Tanggal ${day + 1}</option>`).join('');
        const start = form.elements.plan_start_date.value || today();
        form.elements.plan_schedule_day.value = String(frequency === 'weekly' ? new Date(`${start}T00:00:00Z`).getUTCDay() : Number(start.slice(8, 10)));
    }
    $('#album-plan-day-field').hidden = frequency === 'daily';
    $('label', $('#album-plan-day-field')).textContent = frequency === 'weekly' ? 'Hari menabung' : 'Tanggal menabung';
    $('#album-plan-amount-unit').textContent = ({ daily: 'per hari', weekly: 'per minggu', monthly: 'per bulan' })[frequency];
    $('#album-plan-calendar-help').textContent = frequency === 'monthly' ? 'Tanggal 29, 30, atau 31 mengikuti hari terakhir jika bulan lebih pendek.' : 'Jadwal pertama mengikuti tanggal mulai dan hari pilihanmu.';
    const album = data.albums.find(item => item.id === form.elements.id.value);
    const target = Number(rawMoney(form.elements.target.value));
    const remaining = Math.max(0, target - (album?.balance || 0));
    const plan = readAlbumPlan();
    const validDate = Boolean(plan.startDate && form.elements.plan_start_date.validity.valid);
    const suggestion = validDate && target > 0 ? suggestedAmount(plan, remaining, form.elements.deadline.value, today()) : null;
    const useSuggestion = $('#use-album-plan-suggestion');
    useSuggestion.hidden = !suggestion || suggestion > 1000000000000;
    useSuggestion.dataset.amount = suggestion || '';
    const completion = validDate && plan.amount > 0 ? estimatedCompletion(plan, remaining, today()) : null;
    $('#album-plan-estimate').textContent = !target ? 'Isi nominal target album untuk melihat saran.' : !validDate ? 'Pilih tanggal mulai yang valid.' : remaining === 0 ? 'Target album sudah tercapai. Pengingat berhenti.' : suggestion ? `Saran ${rupiah.format(suggestion)} ${scheduleLabel(plan)} untuk target ${formatDate(form.elements.deadline.value)}.${completion ? ` Dengan nominal ini, perkiraan tercapai ${formatDate(completion)}.` : ''}` : completion ? `Perkiraan tercapai ${formatDate(completion)} jika menabung sesuai jadwal.` : 'Isi nominal setoran untuk melihat perkiraan tanggal tercapai.';
}

function populateAlbumPlan(album) {
    const form = $('#album-form');
    const plan = album?.plan;
    for (const radio of form.querySelectorAll('[name="plan_frequency"]')) radio.checked = radio.value === plan?.frequency;
    form.elements.plan_start_date.value = plan?.startDate || today();
    setMoneyValue(form.elements.plan_amount, plan?.amount || '');
    form.elements.plan_reminder_enabled.checked = plan?.reminderEnabled || false;
    form.elements.plan_reminder_time.value = plan?.reminderTime || '19:00';
    form.elements.plan_paused.checked = plan?.paused || false;
    refreshAlbumPlan(true);
    if (plan) { form.elements.plan_schedule_day.value = String(plan.scheduleDay); refreshAlbumPlan(); }
    renderDeviceSettings();
}

function renderDeviceSettings() {
    const status = deviceNotifications.status();
    const badge = $('#notification-badge');
    badge.textContent = status.active ? 'Aktif' : status.canEnable ? 'Belum aktif' : ('Notification' in window && Notification.permission === 'denied') ? 'Diblokir' : 'Belum tersedia';
    badge.classList.toggle('is-enabled', status.active);
    $('#device-notification-status').textContent = status.message;
    $('#enable-device').hidden = !status.canEnable;
    $('#test-device').hidden = !status.active;
    $('#disable-device').hidden = !status.active;
    $('#album-plan-device-help').textContent = status.message;
    $('#album-enable-device').hidden = !status.canEnable;
    const album = data.albums.find(item => item.id === ui.albumId);
    if (ui.view === 'detail' && album) renderPlan(album);
}

async function deviceAction(button, action) {
    const panel = button.closest('dialog') || $('#notification-settings');
    if (panel.dataset.busy === 'true') return;
    $('.form-error', panel).textContent = '';
    panel.setAttribute('aria-busy', 'true');
    setBusy(panel, true);
    try {
        await deviceNotifications[action]();
        notify(action === 'test' ? 'Notifikasi uji dikirim ke perangkat ini.' : action === 'disable' ? 'Pengingat perangkat ini dinonaktifkan.' : 'Notifikasi perangkat ini sudah aktif.');
    } catch (error) {
        $('.form-error', panel).textContent = error.message || 'Notifikasi belum dapat diatur. Coba lagi.';
        await deviceNotifications.refresh();
    } finally {
        setBusy(panel, false);
        panel.removeAttribute('aria-busy');
        if (button.hidden && ui.view === 'settings') $('#notification-title').focus({ preventScroll: true });
    }
}

function renderTheme() {
    const preference = window.SadakuTheme.getPreference();
    document.querySelectorAll('[name="app_theme"]').forEach(input => { input.checked = input.value === preference; });
    $('#theme-description').textContent = preference === 'system' ? 'Mengikuti tema perangkat secara otomatis.' : `Tema ${preference === 'dark' ? 'gelap' : 'terang'} digunakan di seluruh aplikasi.`;
}

function renderSettings() {
    renderTheme();
    renderDeviceSettings();
    for (const [selector, key] of [['#rate-app', 'rateUrl'], ['#support-developer', 'supportUrl']]) {
        const link = $(selector);
        let url;
        try {
            const candidate = new URL(data.settings[key]);
            if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) url = candidate.href;
        } catch { /* Unconfigured destinations stay visibly unavailable. */ }
        $('.setting-link-status', link).hidden = Boolean(url);
        $('.setting-external', link).hidden = !url;
        if (url) {
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.removeAttribute('aria-disabled');
            link.title = 'Buka di tab baru';
        } else {
            link.removeAttribute('href');
            link.removeAttribute('target');
            link.removeAttribute('title');
            link.setAttribute('aria-disabled', 'true');
        }
    }
}

function openDialog(dialog) {
    lastDialogOpener = document.activeElement;
    const error = $('.form-error', dialog);
    if (error) error.textContent = '';
    dialog.showModal();
    document.body.classList.add('dialog-open');
}

function setBusy(dialog, busy) {
    dialog.dataset.busy = String(busy);
    dialog.querySelectorAll('button, input, textarea, select').forEach(control => {
        if (busy) {
            control.dataset.originalDisabled = String(control.disabled);
            control.disabled = true;
        } else {
            control.disabled = control.dataset.originalDisabled === 'true';
            delete control.dataset.originalDisabled;
        }
    });
    const submit = $('button[type="submit"]', dialog) || $('#confirm-delete', dialog);
    if (submit) {
        if (busy) {
            submit.dataset.originalText = submit.textContent;
            submit.textContent = 'Menyimpan…';
        } else {
            submit.textContent = submit.dataset.originalText;
        }
    }
}

function refreshCoverPreview() {
    const form = $('#album-form');
    const album = data.albums.find(item => item.id === form.elements.id.value);
    const hasPhoto = Boolean(previewUrl || (album?.imageVersion && !form.elements.remove_image.checked));
    $('#preview-image').src = previewUrl || (hasPhoto ? imageUrl(album) : 'assets/images/album-cover.svg');
    $('#cover-preview').classList.toggle('has-photo', hasPhoto);
    $('#cover-preview').dataset.color = form.elements.color.value;
    $('#preview-caption').textContent = form.elements.name.value.trim() || 'Tempat untuk impianmu.';
}

function openAlbumForm(id = null) {
    const album = data.albums.find(item => item.id === id);
    const form = $('#album-form');
    form.reset();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    form.elements.id.value = album?.id || '';
    form.elements.name.value = album?.name || '';
    setMoneyValue(form.elements.target, album?.target || '');
    form.elements.deadline.value = album?.deadline || '';
    form.elements.motivation.value = album?.motivation || '';
    form.elements.color.value = album?.color || 'sage';
    $('#album-dialog-title').textContent = album ? 'Ubah album' : 'Buat album baru';
    $('#remove-image-label').hidden = !album?.imageVersion;
    populateAlbumPlan(album);
    refreshCoverPreview();
    openDialog($('#album-dialog'));
    $('#album-name').focus();
}

function updateEntryHint() {
    const form = $('#entry-form');
    const album = data.albums.find(item => item.id === form.elements.album_id.value);
    $('#entry-context-album').textContent = album?.name || 'Pilih album';
    $('#entry-balance-hint').textContent = album ? `Saldo tersedia: ${rupiah.format(album.balance)}` : '';
    if (form.elements.type.value === 'withdrawal' && form.dataset.prefilledAmount === form.elements.amount.value) {
        setMoneyValue(form.elements.amount, '');
        delete form.dataset.prefilledAmount;
    }
    $('button[type="submit"]', form).textContent = form.elements.id.value ? 'Simpan perubahan' : form.elements.type.value === 'withdrawal' ? 'Simpan penarikan' : 'Simpan setoran';
}

function openEntryForm(albumId = null, entryId = null) {
    if (!data.albums.length) {
        notify('Buat album tujuan dulu, lalu tambahkan catatan uangmu.');
        openAlbumForm();
        return;
    }
    const entry = data.entries.find(item => item.id === entryId);
    if (entryId && !entry) { notify('Catatan sudah tidak tersedia. Muat ulang halaman.'); return; }
    let destination;
    try {
        destination = entryDestination(data.albums, { entry, albumId, viewedAlbumId: ui.view === 'detail' ? ui.albumId : null, filteredAlbumId: ui.view === 'statistics' ? ui.statistics.albumId : 'all' });
    } catch (error) { notify(error.message); return; }
    const form = $('#entry-form');
    form.reset();
    delete form.dataset.prefilledAmount;
    form.elements.id.value = entry?.id || '';
    form.elements.type.value = entry?.type || 'deposit';
    $('#entry-album').innerHTML = data.albums.map(album => `<option value="${album.id}">${escapeHtml(album.name)}</option>`).join('');
    form.elements.album_id.value = destination.albumId;
    $('#entry-album').value = destination.albumId;
    $('#entry-album-picker').hidden = destination.locked;
    $('#entry-album').disabled = destination.locked;
    $('#entry-album').required = !destination.locked;
    setMoneyValue(form.elements.amount, entry?.amount || '');
    const album = data.albums.find(item => item.id === destination.albumId);
    if (!entry && destination.locked && album.plan && !album.plan.paused && album.balance < album.target) {
        const remaining = Math.max(0, album.plan.amount - periodDeposits(album.plan, data.entries, album.id, today()));
        setMoneyValue(form.elements.amount, Math.min(remaining || album.plan.amount, album.target - album.balance));
        form.dataset.prefilledAmount = form.elements.amount.value;
    }
    $('#entry-date-label').textContent = entry ? `Dicatat ${formatDate(entry.date)} · WIB` : 'Tanggal otomatis · WIB';
    form.elements.note.value = entry?.note || '';
    $('#entry-dialog-title').textContent = entry ? 'Ubah catatan uang' : 'Catat uang';
    updateEntryHint();
    openDialog($('#entry-dialog'));
    $('#entry-amount').focus();
}

function openDelete(kind, id) {
    const item = kind === 'album' ? data.albums.find(album => album.id === id) : data.entries.find(entry => entry.id === id);
    if (!item) return;
    pendingDelete = { kind, id };
    $('#delete-title').textContent = kind === 'album' ? 'Hapus album ini?' : 'Hapus catatan ini?';
    $('#delete-description').textContent = kind === 'album'
        ? `Album “${item.name}” dan ${item.entryCount} catatan uang di dalamnya akan dihapus. Tindakan ini tidak dapat dibatalkan.`
        : `Catatan ${item.type === 'deposit' ? 'setoran' : 'penarikan'} ${rupiah.format(item.amount)} akan dihapus dan saldo album dihitung ulang.`;
    openDialog($('#delete-dialog'));
    $('[data-close]', $('#delete-dialog')).focus();
}

document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => {
        if (dialog.dataset.busy === 'true') event.preventDefault();
    });
    dialog.addEventListener('close', () => {
        document.body.classList.remove('dialog-open');
        if (dialog.id === 'album-dialog' && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        if (lastDialogOpener?.isConnected) lastDialogOpener.focus();
        else $('#konten').focus({ preventScroll: true });
    });
});

document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) { close.closest('dialog').close(); return; }
    const monthButton = event.target.closest('[data-report-month], [data-period-month]');
    if (monthButton) {
        if (monthButton.getAttribute('aria-disabled') === 'true') return;
        ui.statistics.period = monthButton.dataset.reportMonth || monthButton.dataset.periodMonth;
        updatePeriodSelection();
        return;
    }
    const reportType = event.target.closest('[data-report-type]');
    if (reportType) {
        monthlyReportType = reportType.dataset.reportType;
        renderStatistics();
        return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { navigate(viewButton.dataset.view); return; }
    const filterButton = event.target.closest('[data-filter]');
    if (filterButton) {
        ui.filter = filterButton.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(button => {
            const active = button === filterButton;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        renderAlbums();
        return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    switch (button.dataset.action) {
        case 'settings':
            renderSettings();
            navigate('settings');
            deviceNotifications.refresh();
            break;
        case 'settings-back': navigate(ui.settingsReturn.view, ui.settingsReturn.albumId); break;
        case 'new-album': openAlbumForm(); break;
        case 'edit-album': openAlbumForm(id); break;
        case 'back-to-top':
            $('#konten').focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            break;
        case 'open-album': navigate('detail', id); break;
        case 'new-entry': openEntryForm(id); break;
        case 'edit-entry': openEntryForm(null, id); break;
        case 'delete-album': openDelete('album', id); break;
        case 'delete-entry': openDelete('entry', id); break;
        case 'retry': load(); break;
        case 'filter-history': openHistoryFilter(); break;
        case 'export-history': exportHistory(); break;
        case 'reset-history':
            setHistoryFilters(DEFAULT_ACTIVITY_FILTERS);
            $('#history-query').focus();
            break;
        case 'history-report':
            ui.statistics.period = button.dataset.month === today().slice(0, 7) ? 'current' : button.dataset.month;
            ui.statistics.albumId = ui.history.albumId;
            renderStatistics();
            navigate('statistics');
            break;
        case 'view-history':
            setHistoryFilters(DEFAULT_ACTIVITY_FILTERS);
            navigate('history');
            break;
        case 'more-history': {
            const previousCount = $('#all-entries').querySelectorAll('summary').length;
            ui.historyLimit += ACTIVITY_PAGE_SIZE;
            renderHistory();
            $('#all-entries').querySelectorAll('summary')[previousCount]?.focus();
            $('#period-announcement').textContent = 'Aktivitas sebelumnya sudah ditampilkan.';
            break;
        }
        case 'more-album-history': {
            const previousCount = $('#detail-entries').querySelectorAll('summary').length;
            ui.detailLimit += ACTIVITY_PAGE_SIZE;
            renderDetail();
            $('#detail-entries').querySelectorAll('summary')[previousCount]?.focus();
            $('#period-announcement').textContent = 'Aktivitas album sebelumnya sudah ditampilkan.';
            break;
        }
    }
});

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

$('#monthly-report').addEventListener('change', event => {
    const key = { 'report-album': 'albumId', 'report-month': 'period' }[event.target.id];
    if (!key) return;
    ui.statistics[key] = event.target.value;
    updatePeriodSelection();
});

$('#album-search').addEventListener('input', event => {
    ui.search = event.target.value.trim();
    renderAlbums();
});
$('#album-form').addEventListener('input', event => {
    refreshCoverPreview();
    if (event.target.name !== 'plan_frequency') refreshAlbumPlan();
});
$('#entry-album').addEventListener('change', event => {
    $('#entry-album-id').value = event.target.value;
    updateEntryHint();
});
document.querySelectorAll('#entry-form [name="type"]').forEach(radio => radio.addEventListener('change', updateEntryHint));
document.querySelectorAll('[name="plan_frequency"]').forEach(radio => radio.addEventListener('change', () => refreshAlbumPlan(true)));
$('#clear-album-plan').addEventListener('click', () => {
    document.querySelectorAll('[name="plan_frequency"]').forEach(radio => { radio.checked = false; });
    refreshAlbumPlan();
    $('[name="plan_frequency"]').focus();
});
$('#use-album-plan-suggestion').addEventListener('click', event => {
    setMoneyValue($('#album-plan-amount'), event.currentTarget.dataset.amount);
    refreshAlbumPlan();
});
for (const [selector, action] of [['#enable-device', 'enable'], ['#album-enable-device', 'enable'], ['#disable-device', 'disable'], ['#test-device', 'test']]) {
    $(selector).addEventListener('click', event => deviceAction(event.currentTarget, action));
}
$('#album-image').addEventListener('change', event => {
    const file = event.target.files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (file && (file.size > 4 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
        $('.form-error', $('#album-dialog')).textContent = 'Pilih gambar JPG, PNG, atau WebP, maksimal 4 MB.';
        event.target.value = '';
    } else {
        $('.form-error', $('#album-dialog')).textContent = '';
        if (file) {
            previewUrl = URL.createObjectURL(file);
            $('#album-form').elements.remove_image.checked = false;
        }
    }
    refreshCoverPreview();
});
$('#album-form').elements.remove_image.addEventListener('change', event => {
    if (event.target.checked) {
        $('#album-image').value = '';
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
    refreshCoverPreview();
});

$('#album-form').addEventListener('submit', async event => {
    event.preventDefault();
    const dialog = $('#album-dialog');
    const body = moneyFormData(event.target);
    const form = event.target;
    const hasPlan = Boolean(form.elements.plan_frequency.value);
    body.set('plan_enabled', hasPlan ? '1' : '0');
    if (hasPlan) {
        body.set('plan_schedule_day', readAlbumPlan().frequency === 'daily' ? '1' : readAlbumPlan().scheduleDay);
        body.set('plan_reminder_time', form.elements.plan_reminder_time.value || '19:00');
        body.set('plan_reminder_enabled', form.elements.plan_reminder_enabled.checked ? '1' : '0');
        body.set('plan_paused', form.elements.plan_paused.checked ? '1' : '0');
    }
    const isNew = !body.get('id');
    $('.form-error', dialog).textContent = '';
    setBusy(dialog, true);
    try {
        const result = await request('save_album', body);
        acceptSnapshot(result);
        setBusy(dialog, false);
        dialog.close();
        navigate('detail', result.savedId);
        notify(isNew ? 'Album dibuat. Impianmu sekarang punya tempat.' : 'Perubahan album sudah disimpan.');
    } catch (error) {
        $('.form-error', dialog).textContent = error.message;
        setBusy(dialog, false);
    }
});

$('#entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const dialog = $('#entry-dialog');
    const body = moneyFormData(event.target);
    const isNew = !body.get('id');
    $('.form-error', dialog).textContent = '';
    setBusy(dialog, true);
    try {
        const result = await request('save_entry', body);
        acceptSnapshot(result);
        setBusy(dialog, false);
        dialog.close();
        const entryMonth = result.entries.find(entry => entry.id === result.savedId)?.date.slice(0, 7) || today().slice(0, 7);
        const message = isNew ? 'Catatan tersimpan. Saldo albummu sudah diperbarui.' : 'Perubahan catatan sudah disimpan.';
        const viewedPeriod = ui.statistics.period;
        notify(ui.view !== 'statistics' || entryMonth === resolveMonth(viewedPeriod, today()) ? message : `${message} Catatan berada di ${formatMonth(entryMonth)}; pilih bulan tersebut untuk melihatnya.`);
    } catch (error) {
        $('.form-error', dialog).textContent = error.message;
        setBusy(dialog, false);
    }
});

$('#confirm-delete').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const dialog = $('#delete-dialog');
    const { kind, id } = pendingDelete;
    const body = new FormData();
    body.set('id', id);
    $('.form-error', dialog).textContent = '';
    setBusy(dialog, true);
    try {
        const result = await request(`delete_${kind}`, body);
        acceptSnapshot(result);
        setBusy(dialog, false);
        dialog.close();
        pendingDelete = null;
        notify(kind === 'album' ? 'Album dan catatannya sudah dihapus.' : 'Catatan dihapus. Saldo sudah dihitung ulang.');
    } catch (error) {
        $('.form-error', dialog).textContent = error.message;
        setBusy(dialog, false);
    }
});

window.addEventListener('hashchange', () => {
    readRoute();
    renderView();
    renderDetail();
    if (ui.view === 'settings') deviceNotifications.refresh();
});

document.querySelectorAll('[name="app_theme"]').forEach(input => {
    input.addEventListener('change', () => {
        if (!window.SadakuTheme.setPreference(input.value)) notify('Tema diterapkan. Penyimpanan browser tidak tersedia; pilihan berlaku selama halaman ini terbuka.');
    });
});
window.addEventListener('sadaku:theme', renderTheme);
window.addEventListener('focus', () => {
    if (ui.view === 'settings' && $('#notification-settings').dataset.busy !== 'true') deviceNotifications.refresh();
});

async function load() {
    $('#connection-error').hidden = true;
    $('#loading').hidden = false;
    try {
        const result = await request();
        readRoute();
        acceptSnapshot(result);
        $('#application').hidden = ui.view === 'settings';
    } catch (error) {
        $('#connection-message').textContent = error.message;
        $('#connection-error').hidden = false;
    } finally {
        $('#loading').hidden = true;
    }
}

function updateHeaderDate() {
    $('#today').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
}

let calendarDate = today();
function refreshCalendar() {
    const nextDate = today();
    if (nextDate === calendarDate) return;
    calendarDate = nextDate;
    updateHeaderDate();
    if (data.csrf) {
        renderSummary();
        renderPeriods();
        renderDetail();
        renderAlbums();
    }
}
window.addEventListener('focus', refreshCalendar);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCalendar(); });
setInterval(refreshCalendar, 60000);
updateHeaderDate();
readRoute();
renderSettings();
if (ui.view === 'settings') renderView();
load();

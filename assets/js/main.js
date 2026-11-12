import { calculateProgress, formatProgress } from './progress.js';
import { availableMonths, createMonthlyReport, formatMonth, resolveMonth, summarizeMonth } from './monthly.js';
import { renderMoneySummary, renderMonthlyReport } from './monthly-view.js';
import { copyStatisticsToHistory, createNavigationState, parseRoute, routeFor } from './navigation.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const ui = createNavigationState();
let data = { albums: [], entries: [], csrf: '' };
let pendingDelete = null;
let previewUrl = null;
let toastTimer;
let lastDialogOpener;

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
    data = { albums: result.albums, entries: result.entries, csrf: result.csrf || data.csrf };
    render();
}

function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}

function readRoute() {
    Object.assign(ui, parseRoute(location.hash));
}

function navigate(view, albumId = null, focus = true) {
    ui.view = view;
    ui.albumId = albumId;
    const route = routeFor(view, albumId);
    if (location.hash !== `#${route}`) history.pushState(null, '', `#${route}`);
    renderView();
    renderDetail();
    if (focus) {
        const heading = view === 'detail' ? $('#detail-title') : $({ overview: '#overview-title', albums: '#albums-title', history: '#history-title', statistics: '#statistics-title' }[view]);
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
    $('#header-location').textContent = ({ overview: 'Ruang tabunganmu', albums: 'Album target', detail: 'Album target / Detail', history: 'Riwayat uangmu', statistics: 'Statistik tabungan' })[ui.view];
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

function updateMonthControl(id, selection) {
    const date = today();
    const currentMonth = date.slice(0, 7);
    const control = $(`#${id}`);
    control.innerHTML = availableMonths(data.entries, date, selection).map(month =>
        `<option value="${month === currentMonth ? 'current' : month}">${formatMonth(month, currentMonth)}</option>`
    ).join('');
    control.value = selection;
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
    updateMonthControl('report-month', ui.statistics.period);
    updateAlbumControl('report-album', ui.statistics);
    const report = createMonthlyReport(data.entries, ui.statistics.period, today(), ui.statistics.albumId);
    $('#monthly-report').innerHTML = renderMonthlyReport(report);
}

function renderHistory() {
    updateMonthControl('history-month', ui.history.period);
    updateAlbumControl('history-album', ui.history);
    const month = resolveMonth(ui.history.period, today());
    const throughDay = month === today().slice(0, 7) ? Number(today().slice(8, 10)) : 31;
    const summary = summarizeMonth(data.entries, month, ui.history.albumId, throughDay);
    $('#history-period-title').textContent = formatMonth(month, today().slice(0, 7));
    $('#history-count').textContent = `${summary.count} catatan`;
    $('#history-summary').innerHTML = renderMoneySummary(summary);

    if (!summary.count) {
        $('#all-entries').innerHTML = renderEntries([], `Belum ada catatan untuk ${formatMonth(month)}.`, 'Pilih bulan atau album lain, atau tambahkan catatan uang untuk periode ini.');
        return;
    }
    const days = new Map();
    for (const entry of summary.entries) {
        if (!days.has(entry.date)) days.set(entry.date, []);
        days.get(entry.date).push(entry);
    }
    $('#all-entries').innerHTML = [...days].map(([date, entries]) =>
        `<section class="history-day"><div class="history-day-heading"><h3>${formatDate(date)}</h3><span>${entries.length} catatan</span></div>${renderEntries(entries)}</section>`
    ).join('');
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
    updateMonthControl('detail-month', ui.detailPeriod);
}

function updatePeriodSelection(section) {
    if (section === 'statistics') renderStatistics();
    else if (section === 'history') renderHistory();
    else renderDetail();
    const selection = section === 'detail' ? ui.detailPeriod : ui[section].period;
    const albumId = section === 'detail' ? ui.albumId : ui[section].albumId;
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
    $('#album-detail').innerHTML = `<div class="detail-toolbar"><button type="button" class="text-button" data-view="albums">${icon('back')}Kembali ke album</button><div class="flex gap-2"><button type="button" class="button button-outline" data-action="edit-album" data-id="${album.id}">${icon('edit')}Ubah</button><button type="button" class="icon-button" data-action="delete-album" data-id="${album.id}" aria-label="Hapus album ${escapeHtml(album.name)}">${icon('trash')}</button></div></div><div class="detail-layout">${albumCover(album, 'detail-cover')}<div class="detail-copy"><p class="eyebrow">${album.balance >= album.target ? 'TARGET TERCAPAI' : 'ALBUM TARGET'}</p><h1 id="detail-title" tabindex="-1">${escapeHtml(album.name)}</h1>${album.motivation ? `<p class="detail-motivation">“${escapeHtml(album.motivation)}”</p>` : ''}<p class="detail-saved">${rupiah.format(album.balance)}</p><p class="detail-target">terkumpul dari target ${rupiah.format(album.target)}</p>${renderProgress(album)}<div class="album-progress-text"><strong>${escapeHtml(formatProgress(progress(album)))} tercapai</strong><span>${album.entryCount} catatan</span></div><div class="detail-metrics"><div><p>Masih dibutuhkan</p><strong>${remaining ? rupiah.format(remaining) : 'Sudah tercapai ✓'}</strong></div><div><p>Target tanggal</p><strong>${formatDate(album.deadline)}</strong></div></div><button type="button" class="button button-primary" data-action="new-entry" data-id="${album.id}">${icon('plus')}Tambah catatan uang</button></div></div>`;
    const month = resolveMonth(ui.detailPeriod, today());
    const summary = summarizeMonth(data.entries, month, album.id, month === today().slice(0, 7) ? Number(today().slice(8, 10)) : 31);
    $('#detail-count').textContent = `${summary.count} catatan pada ${formatMonth(month, today().slice(0, 7))}`;
    $('#detail-month-summary').innerHTML = renderMoneySummary(summary);
    $('#detail-entries').innerHTML = renderEntries(summary.entries, `Belum ada catatan untuk ${formatMonth(month)}.`, 'Pilih bulan lain atau tambahkan catatan uang untuk album ini.');
}

function render() {
    renderSummary();
    renderMotivation();
    renderAlbums();
    renderPeriods();
    renderView();
    renderDetail();
}

function openDialog(dialog) {
    lastDialogOpener = document.activeElement;
    $('.form-error', dialog).textContent = '';
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
    form.elements.target.value = album?.target || '';
    form.elements.deadline.value = album?.deadline || '';
    form.elements.motivation.value = album?.motivation || '';
    form.elements.color.value = album?.color || 'sage';
    $('#album-dialog-title').textContent = album ? 'Ubah album' : 'Buat album baru';
    $('#remove-image-label').hidden = !album?.imageVersion;
    refreshCoverPreview();
    openDialog($('#album-dialog'));
    $('#album-name').focus();
}

function updateEntryHint() {
    const album = data.albums.find(item => item.id === $('#entry-album').value);
    $('#entry-balance-hint').textContent = album ? `Saldo album saat ini: ${rupiah.format(album.balance)}. Penarikan mengikuti saldo pada tanggal catatan.` : '';
}

function openEntryForm(albumId = null, entryId = null) {
    if (!data.albums.length) {
        notify('Buat album tujuan dulu, lalu tambahkan catatan uangmu.');
        openAlbumForm();
        return;
    }
    const entry = data.entries.find(item => item.id === entryId);
    const form = $('#entry-form');
    form.reset();
    form.elements.id.value = entry?.id || '';
    form.elements.type.value = entry?.type || 'deposit';
    $('#entry-album').innerHTML = data.albums.map(album => `<option value="${album.id}">${escapeHtml(album.name)}</option>`).join('');
    const filteredAlbum = ui.view === 'history' ? ui.history.albumId : ui.view === 'statistics' ? ui.statistics.albumId : 'all';
    $('#entry-album').value = entry?.albumId || albumId || ui.albumId || (filteredAlbum !== 'all' ? filteredAlbum : data.albums[0].id);
    $('#entry-album').disabled = Boolean(entry);
    form.elements.amount.value = entry?.amount || '';
    form.elements.date.max = today();
    form.elements.date.value = entry?.date || today();
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
    const monthButton = event.target.closest('[data-report-month]');
    if (monthButton) {
        ui.statistics.period = monthButton.dataset.reportMonth === today().slice(0, 7) ? 'current' : monthButton.dataset.reportMonth;
        updatePeriodSelection('statistics');
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
        case 'new-album': openAlbumForm(); break;
        case 'edit-album': openAlbumForm(id); break;
        case 'open-album': navigate('detail', id); break;
        case 'new-entry': openEntryForm(id); break;
        case 'edit-entry': openEntryForm(null, id); break;
        case 'delete-album': openDelete('album', id); break;
        case 'delete-entry': openDelete('entry', id); break;
        case 'retry': load(); break;
        case 'view-statistics-history':
            copyStatisticsToHistory(ui);
            renderHistory();
            navigate('history');
            break;
        case 'view-current-history':
            ui.history = { period: 'current', albumId: 'all' };
            renderHistory();
            navigate('history');
            break;
    }
});

for (const [id, section, key] of [
    ['report-month', 'statistics', 'period'],
    ['report-album', 'statistics', 'albumId'],
    ['history-month', 'history', 'period'],
    ['history-album', 'history', 'albumId']
]) {
    $(`#${id}`).addEventListener('change', event => {
        ui[section][key] = event.target.value;
        updatePeriodSelection(section);
    });
}
$('#detail-month').addEventListener('change', event => {
    ui.detailPeriod = event.target.value;
    updatePeriodSelection('detail');
});

$('#album-search').addEventListener('input', event => {
    ui.search = event.target.value.trim();
    renderAlbums();
});
$('#album-form').addEventListener('input', refreshCoverPreview);
$('#entry-album').addEventListener('change', updateEntryHint);
$('#album-image').addEventListener('change', event => {
    const file = event.target.files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (file && (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
        $('.form-error', $('#album-dialog')).textContent = 'Pilih gambar JPG, PNG, atau WebP, maksimal 5 MB.';
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
    const body = new FormData(event.target);
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
    const body = new FormData(event.target);
    body.set('album_id', $('#entry-album').value);
    const isNew = !body.get('id');
    $('.form-error', dialog).textContent = '';
    setBusy(dialog, true);
    try {
        const result = await request('save_entry', body);
        acceptSnapshot(result);
        setBusy(dialog, false);
        dialog.close();
        const entryMonth = String(body.get('date')).slice(0, 7);
        const message = isNew ? 'Catatan tersimpan. Saldo albummu sudah diperbarui.' : 'Perubahan catatan sudah disimpan.';
        const viewedPeriod = ui.view === 'detail' ? ui.detailPeriod : ui.view === 'history' ? ui.history.period : ui.view === 'statistics' ? ui.statistics.period : 'current';
        notify(entryMonth === resolveMonth(viewedPeriod, today()) ? message : `${message} Catatan berada di ${formatMonth(entryMonth)}; pilih bulan tersebut untuk melihatnya.`);
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
});

async function load() {
    $('#connection-error').hidden = true;
    $('#loading').hidden = false;
    try {
        const result = await request();
        readRoute();
        acceptSnapshot(result);
        $('#application').hidden = false;
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
    $('#entry-date').max = nextDate;
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
load();

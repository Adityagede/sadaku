import { $ } from './components/dom.js';
import { today } from './domain/dates.js';
import { moneyDisplay, albumCurrency } from './domain/currency.js';
import { DEFAULT_ACTIVITY_FILTERS, ACTIVITY_PAGE_SIZE } from './domain/activity.js';
import { applyRoute, createNavigationState, isSettingsView, parseRoute, routeFor } from './components/navigation.js';
import { createDeviceNotifications } from './data/reminders.js';
import { bindMoneyInputs } from './components/money-input.js';
import { bindActivityMotion } from './components/activity-motion.js';
import { createDataSource } from './data/data-source.js';
import { createDialogs } from './components/dialog.js';
import { createAppMenu } from './components/app-menu.js';
import { createActivityList } from './components/activity-list.js';
import { createOverviewPage } from './pages/overview.js';
import { createAlbumsPage } from './pages/albums.js';
import { createHistoryPage } from './pages/history.js';
import { createStatisticsPage } from './pages/statistics.js';
import { createSettingsPage } from './pages/settings.js';
import { createAlbumForm } from './pages/album-form.js';
import { createEntryForm } from './pages/entry-form.js';
import { createBackupPage } from './pages/backup.js';

export function startApp() {
    const ui = createNavigationState();
    const appMenu = $('#app-menu');
    let data = { albums: [], entries: [], csrf: '', settings: {}, ready: false, source: 'local', revision: -1 };
    let pendingDelete = null;
    const localUpdates = typeof BroadcastChannel === 'function' ? new BroadcastChannel('sadaku-local-updates') : null;
    const launchUrl = new URL(location.href);
    const dataSource = createDataSource({ serverRequest, initialSource: launchUrl.searchParams.get('storage'), changed: revision => localUpdates?.postMessage({ revision }) });
    if (launchUrl.searchParams.has('storage')) {
        launchUrl.searchParams.delete('storage');
        history.replaceState(null, '', `${launchUrl.pathname}${launchUrl.search}${launchUrl.hash}`);
    }
    const deviceNotifications = createDeviceNotifications({ request, changed: (...args) => renderDeviceSettings(...args) });
    const getData = () => data;
    const dialogs = createDialogs();
    const { notify, openDialog, setBusy } = dialogs;
    const { closeAppMenu, toggleAppMenu } = createAppMenu();
    const { renderActivityList, renderEntries } = createActivityList({ getData });
    const { renderSummary, renderMotivation, renderRecent } = createOverviewPage({ getData, renderEntries });
    const { renderAlbums, renderDetail, renderPlan } = createAlbumsPage({ getData, ui, deviceNotifications, renderActivityList });
    const { renderTheme, renderDeviceSettings, deviceAction, renderSettings, renderStorageSettings } = createSettingsPage({ getData, ui, dataSource, deviceNotifications, renderPlan, notify, setBusy });
    const { renderHistory, setHistoryFilters, openHistoryFilter, exportHistory } = createHistoryPage({ getData, ui, openDialog, renderActivityList });
    const statisticsPage = createStatisticsPage({ getData, ui });
    const { renderStatistics, updatePeriodSelection } = statisticsPage;
    const albumForm = createAlbumForm({ getData, renderDeviceSettings, openDialog, setBusy, request, acceptSnapshot, navigate, notify });
    const { openAlbumForm } = albumForm;
    const { openEntryForm } = createEntryForm({ getData, ui, openAlbumForm, openDialog, setBusy, request, acceptSnapshot, notify });
    const backupPage = createBackupPage({ ui, dataSource, acceptSnapshot, navigate, notify, request, renderStorageSettings, setBusy, openDialog });
    const { storageAction } = backupPage;
    bindMoneyInputs(document);
    bindActivityMotion(document);
    if ('ResizeObserver' in window) {
        new ResizeObserver(([entry]) => {
            document.documentElement.style.setProperty('--mobile-nav-height', `${entry.target.getBoundingClientRect().height}px`);
        }).observe($('.sidebar'));
    }

    async function serverRequest(action = 'state', body = null) {
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
        if (response.status === 401) throw new Error('Akses server pribadi belum diizinkan. Gunakan kredensial pemilik server.');
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error('Respons server tidak dapat dibaca. Pastikan Sadaku dijalankan melalui PHP.');
        }
        if (!response.ok) throw new Error(result.error || 'Data belum dapat diproses.');
        return result;
    }

    function request(action = 'state', body = null) { return dataSource.request(action, body); }

    function acceptSnapshot(result) {
        if (result.source !== dataSource.source()) return;
        if (result.source === 'local' && data.source === 'local' && result.revision < data.revision) return;
        data = { ...result, ready: true, csrf: result.source === 'local' ? '' : result.csrf || data.csrf,
            settings: result.settings || (result.source === data.source ? data.settings : {}) };
        data.albums = data.albums.map(album => ({ ...album, currency: album.currency || 'IDR' }));
        statisticsPage.invalidate();
        renderSettings();
        render();
        if (result.push) deviceNotifications.refresh(result.push);
    }

    function readRoute() {
        applyRoute(ui, parseRoute(location.hash));
    }

    function navigate(view, albumId = null, focus = true) {
        closeAppMenu();
        const fromDetail = ui.view === 'detail';
        applyRoute(ui, { view, albumId });
        const route = routeFor(view, albumId);
        if (location.hash !== `#${route}`) {
            const state = isSettingsView(view) ? { settingsFromApp: true }
                : view === 'detail' && !fromDetail ? { detailFromApp: true } : null;
            history.pushState(state, '', `#${route}`);
        }
        renderView();
        renderDetail();
        if (focus) {
            const heading = $(`#${ui.view}-title`);
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
        $('#backup-view').hidden = ui.view !== 'backup';
        const settingsView = isSettingsView(ui.view);
        const focusedView = settingsView || ui.view === 'detail';
        $('.sidebar').hidden = focusedView;
        $('.app-header').hidden = focusedView;
        $('.app-credit').hidden = focusedView;
        $('#application').hidden = !data.ready || settingsView;
        const canCreateFromView = ['history', 'statistics'].includes(ui.view)
            || (data.albums.length > 0 && ['overview', 'albums'].includes(ui.view));
        $('#album-create-fab').hidden = !data.ready || !canCreateFromView;
        for (const [action, view] of [['settings', 'settings'], ['backup-settings', 'backup']]) {
            const item = $(`[data-action="${action}"]`, appMenu);
            if (ui.view === view) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        }
        if (!focusedView) {
            $('#header-location').textContent = ({ overview: 'Ruang tabunganmu', albums: 'Album target', history: 'Riwayat uangmu', statistics: 'Statistik tabungan' })[ui.view];
        }
        $('.app-navigation').querySelectorAll('[data-view]').forEach(button => {
            const active = button.dataset.view === (ui.view === 'detail' ? 'albums' : ui.view);
            button.classList.toggle('is-active', active);
            if (active) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
    }

    function renderPeriods() {
        renderStatistics();
        renderHistory();
        renderRecent();
    }

    function render() {
        renderSummary();
        renderMotivation();
        renderAlbums();
        renderPeriods();
        renderView();
        renderDetail();
    }

    function openDelete(kind, id) {
        const item = kind === 'album' ? data.albums.find(album => album.id === id) : data.entries.find(entry => entry.id === id);
        if (!item) return;
        pendingDelete = { kind, id };
        $('#delete-title').textContent = kind === 'album' ? 'Hapus album ini?' : 'Hapus catatan ini?';
        $('#delete-description').textContent = kind === 'album'
            ? `Album “${item.name}” dan ${item.entryCount} catatan uang di dalamnya akan dihapus. Tindakan ini tidak dapat dibatalkan.`
            : `Catatan ${item.type === 'deposit' ? 'setoran' : 'penarikan'} ${moneyDisplay.format(item.amount, albumCurrency(data.albums, item.albumId))} akan dihapus dan saldo album dihitung ulang.`;
        openDialog($('#delete-dialog'));
        $('[data-close]', $('#delete-dialog')).focus();
    }

    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('cancel', event => {
            if (dialog.dataset.busy === 'true') event.preventDefault();
        });
        dialog.addEventListener('close', () => {
            // A new dialog may already be open when the previous close event arrives.
            if (document.querySelector('dialog[open]')) return;
            document.body.classList.remove('dialog-open');
            if (dialog.id === 'album-dialog') albumForm.releasePreview();
            if (dialog.id === 'restore-dialog') backupPage.clearPreview();
            dialogs.restoreFocus();
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
            statisticsPage.selectType(reportType.dataset.reportType);
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
            case 'use-local-data': storageAction('local'); break;
            case 'use-server-data': storageAction('server'); break;
            case 'backup-data': storageAction('backup'); break;
            case 'restore-data': $('#restore-file').click(); break;
            case 'toggle-app-menu': toggleAppMenu(button); break;
            case 'settings':
                navigate('settings');
                deviceNotifications.refresh();
                break;
            case 'backup-settings': navigate('backup'); break;
            case 'settings-back':
                if (history.state?.settingsFromApp) history.back();
                else navigate(ui.settingsReturn.view, ui.settingsReturn.albumId);
                break;
            case 'detail-back':
                if (history.state?.detailFromApp) history.back();
                else navigate('albums');
                break;
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

    $('#album-search').addEventListener('input', event => {
        ui.search = event.target.value.trim();
        renderAlbums();
    });
    for (const [selector, action] of [['#enable-device', 'enable'], ['#album-enable-device', 'enable'], ['#disable-device', 'disable'], ['#test-device', 'test']]) {
        $(selector).addEventListener('click', event => deviceAction(event.currentTarget, action));
    }
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
        closeAppMenu();
        const previousView = ui.view;
        readRoute();
        renderView();
        renderDetail();
        if ([previousView, ui.view].some(view => view === 'detail' || isSettingsView(view))) {
            $(`#${ui.view}-title`)?.focus({ preventScroll: true });
        }
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
        if (data.ready) {
            renderSummary();
            renderPeriods();
            renderDetail();
            renderAlbums();
        }
    }
    window.addEventListener('focus', refreshCalendar);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCalendar(); });
    setInterval(refreshCalendar, 60000);
    localUpdates?.addEventListener('message', event => {
        if (dataSource.source() === 'local' && Number.isSafeInteger(event.data?.revision) && event.data.revision > data.revision) {
            request().then(acceptSnapshot).catch(error => notify(error.message));
        }
    });
    window.addEventListener('focus', () => {
        if (data.ready && dataSource.source() === 'local') request().then(acceptSnapshot).catch(error => notify(error.message));
    });
    updateHeaderDate();
    readRoute();
    renderSettings();
    if (isSettingsView(ui.view)) renderView();
    load();
    if (window.isSecureContext && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* Local data remains usable; offline shell requires a successful registration. */ });
    }
    return { close: async () => { localUpdates?.close(); await dataSource.close(); } };
}

export const runningApp = startApp();

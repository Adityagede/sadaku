import { $ } from '../components/dom.js';

export function createSettingsPage({ getData, ui, dataSource, deviceNotifications, renderPlan, notify, setBusy }) {

    function renderTheme() {
        const preference = window.SadakuTheme.getPreference();
        document.querySelectorAll('[name="app_theme"]').forEach(input => { input.checked = input.value === preference; });
        $('#theme-status').textContent = ({ light: 'Terang', dark: 'Gelap', system: 'Ikuti perangkat' })[preference];
    }

    function renderDeviceSettings() {
        const data = getData();
        const status = dataSource.source() === 'local'
            ? { active: false, canEnable: false, message: 'Rencana menabung tersimpan di perangkat ini. Pengingat saat aplikasi tertutup belum tersedia untuk mode ini. Web Push hanya mengikuti data pada server pribadi.' }
            : deviceNotifications.status();
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

    function renderSettings() {
        const data = getData();
        renderTheme();
        renderDeviceSettings();
        renderStorageSettings();
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

    function renderStorageSettings() {
        const data = getData();
        const local = dataSource.source() === 'local';
        $('#storage-status').textContent = local ? 'Di perangkat ini' : 'Server pribadi';
        $('#storage-description').textContent = local
            ? 'Album, foto, dan catatan disimpan di browser ini, tanpa akun. Cadangkan secara berkala; menghapus data situs juga menghapus tabungan lokal.'
            : 'Data dari versi server sebelumnya. Semua perangkat yang memiliki akses server pribadi menggunakan database yang sama. Ini belum merupakan akun cloud.';
        $('#use-local-data').hidden = local;
        $('#use-server-data').hidden = !local;
        $('#backup-data').disabled = !data.ready;
        $('#restore-data').hidden = !local;
        $('#restore-data').disabled = !data.ready;
        $('#backup-last-created').textContent = local && data.lastBackupAt
            ? `Cadangan terakhir dibuat: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(data.lastBackupAt))} WIB.`
            : local ? 'Belum ada cadangan yang dibuat pada browser ini.' : 'Cadangan server dapat dipulihkan ke penyimpanan perangkat. Data server tetap dipertahankan.';
    }


    return { renderTheme, renderDeviceSettings, deviceAction, renderSettings, renderStorageSettings };
}

import { $ } from '../components/dom.js';
import { today } from '../domain/dates.js';
import { DEFAULT_ACTIVITY_FILTERS, ACTIVITY_PAGE_SIZE } from '../domain/activity.js';
import { isSettingsView } from '../components/navigation.js';

export function createBackupPage({ ui, dataSource, acceptSnapshot, navigate, notify, request, renderStorageSettings, setBusy, openDialog }) {
    let restorePreview = null;
    async function storageAction(action) {
        const panel = $('#storage-settings');
        if (panel.dataset.busy === 'true') return;
        $('.form-error', panel).textContent = '';
        setBusy(panel, true);
        try {
            if (action === 'local' || action === 'server') {
                const result = await dataSource.select(action);
                restorePreview = null;
                ui.albumId = null;
                ui.settingsReturn = { view: 'overview', albumId: null };
                if (isSettingsView(ui.view)) history.replaceState(null, '');
                ui.history = { ...DEFAULT_ACTIVITY_FILTERS };
                ui.historyLimit = ACTIVITY_PAGE_SIZE;
                ui.detailLimit = ACTIVITY_PAGE_SIZE;
                ui.statistics = { period: 'current', albumId: 'all' };
                ui.search = '';
                ui.filter = 'all';
                $('#album-search').value = '';
                $('#history-query').value = '';
                document.querySelectorAll('[data-filter]').forEach(button => {
                    const active = button.dataset.filter === 'all';
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                acceptSnapshot(result);
                $('#connection-error').hidden = true;
                notify(action === 'local' ? 'Penyimpanan perangkat dibuka. Data server tetap disimpan terpisah.' : 'Data server pribadi dibuka. Data perangkat tetap disimpan terpisah.');
            } else if (action === 'backup') {
                const { content } = await dataSource.backup();
                const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `sadaku-${dataSource.source()}-${today()}.json`;
                document.body.append(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
                acceptSnapshot(await request());
                notify('Cadangan dibuat. Selesaikan penyimpanan berkas dan simpan di tempat pribadi.');
            }
        } catch (error) { $('.form-error', panel).textContent = error.message; }
        finally { setBusy(panel, false); renderStorageSettings(); }
    }

    $('#restore-file').addEventListener('change', async event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const panel = $('#storage-settings');
        if (panel.dataset.busy === 'true') return;
        $('.form-error', panel).textContent = '';
        setBusy(panel, true);
        try {
            const preview = await dataSource.preview(file);
            restorePreview = preview;
            $('#restore-summary').textContent = `${preview.state.currency} · ${preview.summary.albums} album, ${preview.summary.entries} catatan, dan ${preview.summary.photos} foto akan dipulihkan. ${preview.current.albums} album dan ${preview.current.entries} catatan pada perangkat ini akan diganti. Data server tidak diubah.`;
            $('#restore-confirmation').checked = false;
            $('#apply-restore').disabled = true;
            openDialog($('#restore-dialog'));
        } catch (error) { $('.form-error', panel).textContent = error.message; }
        finally { setBusy(panel, false); renderStorageSettings(); }
    });
    $('#restore-confirmation').addEventListener('change', event => { $('#apply-restore').disabled = !event.target.checked; });
    $('#apply-restore').addEventListener('click', async () => {
        if (!restorePreview || !$('#restore-confirmation').checked) return;
        const dialog = $('#restore-dialog');
        setBusy(dialog, true);
        $('.form-error', dialog).textContent = '';
        try {
            acceptSnapshot(await dataSource.restore(restorePreview));
            setBusy(dialog, false);
            restorePreview = null;
            dialog.close();
            navigate('overview');
            notify('Cadangan dipulihkan ke perangkat ini.');
        } catch (error) { $('.form-error', dialog).textContent = error.message; setBusy(dialog, false); }
    });


    return { storageAction, clearPreview() { restorePreview = null; } };
}

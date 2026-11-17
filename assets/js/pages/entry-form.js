import { $, escapeHtml } from '../components/dom.js';
import { today, formatDate } from '../domain/dates.js';
import { moneyDisplay, albumCurrency } from '../domain/currency.js';
import { periodDeposits } from '../domain/saving-plan.js';
import { resolveMonth, formatMonth } from '../domain/monthly.js';
import { entryDestination } from '../domain/entry-context.js';
import { setMoneyValue, moneyFormData } from '../components/money-input.js';
import { configureMoneyForm } from '../components/money-form.js';

export function createEntryForm({ getData, ui, openAlbumForm, openDialog, setBusy, request, acceptSnapshot, notify }) {

    function openEntryForm(albumId = null, entryId = null) {
        const data = getData();
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
        $('#entry-album').innerHTML = data.albums.map(album => `<option value="${album.id}">${escapeHtml(album.name)} · ${album.currency}</option>`).join('');
        form.elements.album_id.value = destination.albumId;
        $('#entry-album').value = destination.albumId;
        $('#entry-album-picker').hidden = destination.locked;
        $('#entry-album').disabled = destination.locked;
        $('#entry-album').required = !destination.locked;
        const album = data.albums.find(item => item.id === destination.albumId);
        configureMoneyForm(form, album.currency);
        setMoneyValue(form.elements.amount, entry?.amount || '');
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

    function updateEntryHint() {
        const data = getData();
        const form = $('#entry-form');
        const album = data.albums.find(item => item.id === form.elements.album_id.value);
        $('#entry-context-album').textContent = album?.name || 'Pilih album';
        $('#entry-balance-hint').textContent = album ? `Saldo tersedia: ${moneyDisplay.format(album.balance, album.currency)}` : '';
        if (form.elements.type.value === 'withdrawal' && form.dataset.prefilledAmount === form.elements.amount.value) {
            setMoneyValue(form.elements.amount, '');
            delete form.dataset.prefilledAmount;
        }
        $('button[type="submit"]', form).textContent = form.elements.id.value ? 'Simpan perubahan' : form.elements.type.value === 'withdrawal' ? 'Simpan penarikan' : 'Simpan setoran';
    }

    $('#entry-album').addEventListener('change', event => {
        $('#entry-album-id').value = event.target.value;
        const form = $('#entry-form');
        const code = albumCurrency(getData().albums, event.target.value);
        if (code !== form.dataset.currency) {
            configureMoneyForm(form, code);
            setMoneyValue(form.elements.amount, '');
            delete form.dataset.prefilledAmount;
        }
        updateEntryHint();
    });
    document.querySelectorAll('#entry-form [name="type"]').forEach(radio => radio.addEventListener('change', updateEntryHint));
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


    return { openEntryForm };
}

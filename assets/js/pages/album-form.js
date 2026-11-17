import { $ } from '../components/dom.js';
import { today, formatDate } from '../domain/dates.js';
import { imageUrl } from '../components/album-display.js';
import { currencies, moneyDisplay } from '../domain/currency.js';
import { rawMoney, setMoneyValue, moneyFormData } from '../components/money-input.js';
import { configureMoneyForm } from '../components/money-form.js';
import { suggestedAmount, estimatedCompletion, scheduleLabel, weekdays } from '../domain/saving-plan.js';

export function createAlbumForm({ getData, renderDeviceSettings, openDialog, setBusy, request, acceptSnapshot, navigate, notify }) {
    let previewUrl = null;
    function readAlbumPlan() {
        const form = $('#album-form');
    return { frequency: form.elements.plan_frequency.value, amount: Number(rawMoney(form.elements.plan_amount.value, form.dataset.currency)), startDate: form.elements.plan_start_date.value, scheduleDay: Number(form.elements.plan_schedule_day.value || 1) };
    }

    function refreshAlbumPlan(resetDay = false) {
        const data = getData();
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
        const target = Number(rawMoney(form.elements.target.value, form.dataset.currency));
        const remaining = Math.max(0, target - (album?.balance || 0));
        const plan = readAlbumPlan();
        const validDate = Boolean(plan.startDate && form.elements.plan_start_date.validity.valid);
        const suggestion = validDate && target > 0 ? suggestedAmount(plan, remaining, form.elements.deadline.value, today()) : null;
        const useSuggestion = $('#use-album-plan-suggestion');
        useSuggestion.hidden = !suggestion || suggestion > 1000000000000;
        useSuggestion.dataset.amount = suggestion || '';
        const completion = validDate && plan.amount > 0 ? estimatedCompletion(plan, remaining, today()) : null;
        $('#album-plan-estimate').textContent = !target ? 'Isi nominal target album untuk melihat saran.' : !validDate ? 'Pilih tanggal mulai yang valid.' : remaining === 0 ? 'Target album sudah tercapai. Pengingat berhenti.' : suggestion ? `Saran ${moneyDisplay.format(suggestion, form.dataset.currency)} ${scheduleLabel(plan)} untuk target ${formatDate(form.elements.deadline.value)}.${completion ? ` Dengan nominal ini, perkiraan tercapai ${formatDate(completion)}.` : ''}` : completion ? `Perkiraan tercapai ${formatDate(completion)} jika menabung sesuai jadwal.` : 'Isi nominal setoran untuk melihat perkiraan tanggal tercapai.';
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

    function refreshCoverPreview() {
        const data = getData();
        const form = $('#album-form');
        const album = data.albums.find(item => item.id === form.elements.id.value);
        const hasPhoto = Boolean(previewUrl || (album?.imageVersion && !form.elements.remove_image.checked));
        $('#preview-image').src = previewUrl || (hasPhoto ? imageUrl(album) : 'assets/images/album-cover.svg');
        $('#cover-preview').classList.toggle('has-photo', hasPhoto);
        $('#cover-preview').dataset.color = form.elements.color.value;
        $('#preview-caption').textContent = form.elements.name.value.trim() || 'Tempat untuk impianmu.';
    }

    function openAlbumForm(id = null) {
        const data = getData();
        const album = data.albums.find(item => item.id === id);
        const form = $('#album-form');
        form.reset();
        const selector = $('#album-currency');
        selector.innerHTML = currencies.map(item => '<option value="' + item.code + '">' + item.code + ' — ' + item.name + '</option>').join('');
        selector.value = album?.currency || (data.source === 'server' ? 'IDR' : data.currency || 'IDR');
        selector.disabled = Boolean(album) || data.source === 'server';
        $('#album-currency-help').textContent = data.source === 'server' ? 'Server pribadi menggunakan IDR.' : album ? 'Mata uang album tetap. Buat album baru untuk mata uang lain.' : 'Setoran dan penarikan mengikuti mata uang ini.';
        configureMoneyForm(form, selector.value);
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

    $('#album-currency').addEventListener('change', event => {
        const form = $('#album-form');
        if (event.target.disabled) return;
        const hadAmount = [...form.querySelectorAll('[data-money]')].some(input => input.value);
        configureMoneyForm(form, event.target.value, true);
        $('#album-currency-help').textContent = hadAmount
            ? 'Mata uang diganti. Isi kembali target dan nominal rencana dalam mata uang ini.'
            : 'Setoran dan penarikan mengikuti mata uang ini.';
        refreshAlbumPlan();
        form.elements.target.focus();
    });

    $('#album-form').addEventListener('input', event => {
        refreshCoverPreview();
        if (event.target.name !== 'plan_frequency') refreshAlbumPlan();
    });
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


    return { openAlbumForm, releasePreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; } };
}

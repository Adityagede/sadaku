import { $, escapeHtml, icon } from '../components/dom.js';
import { today, formatDate } from '../domain/dates.js';
import { albumCover, renderProgress, progress, deadlineText } from '../components/album-display.js';
import { moneyDisplay } from '../domain/currency.js';
import { formatProgress } from '../domain/progress.js';
import { periodDeposits, nextPlanDate, scheduleLabel } from '../domain/saving-plan.js';

export function createAlbumsPage({ getData, ui, deviceNotifications, renderActivityList }) {

    function renderAlbums() {
        const data = getData();
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
                <div class="album-card-body"><h3>${escapeHtml(album.name)}</h3><p class="album-reason">${escapeHtml(album.motivation || 'Tabungan pribadi')}</p><div class="album-amounts">${moneyDisplay.format(album.balance, album.currency)}<span>dari ${moneyDisplay.format(album.target, album.currency)}</span></div>${renderProgress(album)}<div class="album-progress-text"><strong>${escapeHtml(formatProgress(progress(album)))} terkumpul</strong><span>${deadlineText(album)}</span></div></div>
            </button>
            <div class="album-card-footer"><button class="text-button" type="button" data-action="new-entry" data-id="${album.id}">${icon('plus')}Catat uang</button><div class="flex"><button class="icon-button" type="button" data-action="edit-album" data-id="${album.id}" aria-label="Ubah album ${escapeHtml(album.name)}">${icon('edit')}</button><button class="icon-button" type="button" data-action="delete-album" data-id="${album.id}" aria-label="Hapus album ${escapeHtml(album.name)}">${icon('trash')}</button></div></div>
        </article>`).join('');
    }

    function renderDetail() {
        const data = getData();
        if (ui.view !== 'detail') return;
        const album = data.albums.find(item => item.id === ui.albumId);
        if (!album) return;
        const remaining = Math.max(0, album.target - album.balance);
        const entries = data.entries.filter(entry => entry.albumId === album.id);
        $('.detail-toolbar [data-action="edit-album"]').dataset.id = album.id;
        const deleteButton = $('.detail-toolbar [data-action="delete-album"]');
        deleteButton.dataset.id = album.id;
        deleteButton.setAttribute('aria-label', `Hapus album ${album.name}`);
        $('#album-detail').innerHTML = `<div class="detail-layout album-focus">${albumCover(album, 'detail-cover')}<div class="detail-copy"><p class="eyebrow">${remaining ? 'TABUNGAN BERJALAN' : 'TARGET TERCAPAI'}</p><h1 id="detail-title" tabindex="-1">${escapeHtml(album.name)}</h1>${album.motivation ? `<p class="detail-motivation">${escapeHtml(album.motivation)}</p>` : ''}
            <div class="album-balance"><span>Saldo album</span><p class="detail-saved">${moneyDisplay.format(album.balance, album.currency)}</p><p class="detail-target">dari target ${moneyDisplay.format(album.target, album.currency)}</p></div>${renderProgress(album)}<div class="album-progress-text"><strong>${escapeHtml(formatProgress(progress(album)))} tercapai</strong></div>
            <div class="detail-metrics"><div><p>Sisa target</p><strong>${remaining ? moneyDisplay.format(remaining, album.currency) : 'Sudah tercapai'}</strong></div>${album.deadline ? `<div><p>Target tanggal</p><strong>${formatDate(album.deadline)}</strong></div>` : ''}</div>
            <button type="button" class="button button-primary album-entry-cta" data-action="new-entry" data-id="${album.id}">${icon('plus')}Catat uang</button></div></div>`;
        renderPlan(album);
        $('#detail-count').textContent = `${entries.length} aktivitas`;
        $('#detail-load-more').hidden = !renderActivityList('#detail-entries', entries, ui.detailLimit, true);
    }

    function renderPlan(album) {
        const data = getData();
        const plan = album.plan;
        if (!plan) { $('#album-plan').innerHTML = ''; return; }
        const completed = album.balance >= album.target;
        const total = periodDeposits(plan, data.entries, album.id, today());
        const next = nextPlanDate(plan, data.entries, album.id, today());
        const active = !completed && !plan.paused;
        const reminder = completed ? 'Pengingat berhenti karena target tercapai.' : plan.paused ? 'Pengingat dijeda.' : !plan.reminderEnabled ? 'Pengingat dimatikan.' : `Pengingat pukul ${plan.reminderTime} WIB.${deviceNotifications.status().active ? '' : ' Notifikasi perangkat ini belum aktif.'}`;
        $('#album-plan').innerHTML = `<section class="saving-plan" aria-labelledby="album-plan-title"><div class="plan-heading"><div><p class="eyebrow">RENCANA MENABUNG</p><h2 id="album-plan-title">${moneyDisplay.format(plan.amount, album.currency)} <span>${escapeHtml(scheduleLabel(plan))}</span></h2></div><span class="plan-status">${completed ? 'Tercapai' : plan.paused ? 'Dijeda' : 'Aktif'}</span></div><div class="plan-overview"><div><p>${active ? 'Jadwal berikutnya' : 'Mulai menabung'}</p><strong>${formatDate(active ? next : plan.startDate)}</strong></div><div><p>Setoran periode ini</p><strong>${moneyDisplay.format(total, album.currency)} <span>/ ${moneyDisplay.format(plan.amount, album.currency)}</span></strong></div></div><p class="plan-reminder">${icon('bell')}${escapeHtml(reminder)}</p></section>`;
    }


    return { renderAlbums, renderDetail, renderPlan };
}

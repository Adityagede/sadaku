import { $, escapeHtml, icon } from './dom.js';
import { today, formatDate, formatActivityDate, historyDates } from '../domain/dates.js';
import { activityPage, activityMonths, activityTypeLabel, activityDayLabel } from '../domain/activity.js';
import { moneyDisplay } from '../domain/currency.js';
import { formatMonth } from '../domain/monthly.js';

export function createActivityList({ getData }) {

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
        const data = getData();
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
                <span class="activity-amount${withdrawal ? ' is-withdrawal' : ''}">${withdrawal ? '−' : '+'}${moneyDisplay.format(entry.amount, album?.currency || 'IDR').replace(/\s/g, inAlbum ? ' ' : '')}</span>
                ${inAlbum ? `<span class="activity-chevron">${icon('chevron')}</span>` : `<span class="history-entry-type${withdrawal ? ' is-withdrawal' : ''}">${type}</span>`}
            </summary>
            <div class="activity-detail"><dl><div><dt>Album</dt><dd>${albumName}</dd></div><div><dt>Tanggal</dt><dd><time datetime="${entry.date}">${formatActivityDate(entry.date)}</time></dd></div>${entry.note ? `<div><dt>Catatan</dt><dd>${escapeHtml(entry.note)}</dd></div>` : ''}</dl><div class="activity-detail-actions"><button type="button" class="text-button" data-action="edit-entry" data-id="${entry.id}" aria-label="Ubah catatan ${escapeHtml(title)}">${icon('edit')}Ubah catatan</button><button type="button" class="text-button activity-delete" data-action="delete-entry" data-id="${entry.id}" aria-label="Hapus catatan ${escapeHtml(title)}">${icon('trash')}Hapus</button></div></div>
        </details>`;
    }

    function renderEntries(entries, emptyTitle = 'Belum ada catatan uang.', emptyDescription = 'Setelah membuat album, tambahkan setoran pertamamu. Setiap catatan akan terlihat di sini.') {
        const data = getData();
        if (!entries.length) return `<div class="empty-entries">${icon('history')}<strong class="text-sm font-medium">${escapeHtml(emptyTitle)}</strong><p>${escapeHtml(emptyDescription)}</p></div>`;
        return entries.map(entry => {
            const album = data.albums.find(item => item.id === entry.albumId);
            const withdrawal = entry.type === 'withdrawal';
            const title = entry.note || (withdrawal ? 'Penarikan tabungan' : 'Setoran tabungan');
            return `<article class="entry-row"><span class="entry-direction ${withdrawal ? 'is-withdrawal' : ''}">${icon(withdrawal ? 'out' : 'in')}</span><div class="entry-info"><h3 title="${escapeHtml(title)}">${escapeHtml(title)}</h3><p>${escapeHtml(album?.name || 'Album')} · ${withdrawal ? 'Penarikan' : 'Setoran'}</p></div><div class="entry-amount ${withdrawal ? 'is-withdrawal' : ''}">${withdrawal ? '−' : '+'}${moneyDisplay.format(entry.amount, album?.currency || 'IDR')}<time datetime="${entry.date}">${formatDate(entry.date)}</time></div><div class="entry-actions"><button class="icon-button" type="button" data-action="edit-entry" data-id="${entry.id}" aria-label="Ubah catatan ${escapeHtml(title)}">${icon('edit')}</button><button class="icon-button" type="button" data-action="delete-entry" data-id="${entry.id}" aria-label="Hapus catatan ${escapeHtml(title)}">${icon('trash')}</button></div></article>`;
        }).join('');
    }


    return { renderActivityList, renderEntries };
}

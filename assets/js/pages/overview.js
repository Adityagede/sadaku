import { $, escapeHtml, icon } from '../components/dom.js';
import { today } from '../domain/dates.js';
import { renderProgress, progress, imageUrl } from '../components/album-display.js';
import { moneyDisplay, currencyGroups, albumCurrency } from '../domain/currency.js';
import { formatProgress } from '../domain/progress.js';
import { summarizeMonth, formatMonth } from '../domain/monthly.js';

export function createOverviewPage({ getData, renderEntries }) {

    function renderSummary() {
        const data = getData();
        const completed = data.albums.filter(album => album.balance >= album.target).length;
        const groups = currencyGroups(data.albums);
        const month = today().slice(0, 7);
        $('#total-balance').classList.toggle('has-currencies', groups.length > 1);
        $('#total-balance').innerHTML = (groups.length ? groups : ['IDR']).map(code => {
            const total = data.albums.filter(album => album.currency === code).reduce((sum, album) => sum + album.balance, 0);
            return '<span class="currency-total">' + escapeHtml(moneyDisplay.format(total, code)) + '</span>';
        }).join('');
        $('#active-count').innerHTML = `${data.albums.length - completed}<span>album</span>`;
        $('#completed-count').innerHTML = `${completed}<span>album</span>`;
        $('#nav-album-count').textContent = data.albums.length;
        $('#filter-count').textContent = data.albums.length;
        const monthly = groups.map(code => {
            const entries = data.entries.filter(entry => albumCurrency(data.albums, entry.albumId) === code);
            const result = summarizeMonth(entries, month);
            return result.count ? moneyDisplay.format(Math.abs(result.net), code) + (result.net < 0 ? ' penarikan' : ' setoran') + ' bersih' : '';
        }).filter(Boolean);
        $('#monthly-summary').textContent = monthly.length ? monthly.join(' · ') + ' bulan ini' : 'Belum ada setoran bulan ini';
    }

    function renderMotivation() {
        const data = getData();
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
        $('#motivation-panel').innerHTML = `<div class="motivation-copy"><p class="eyebrow">${finished ? 'TARGET TERCAPAI' : 'TUJUAN YANG PALING DEKAT'}</p><h2>${escapeHtml(featured.name)}</h2><p>${escapeHtml(featured.motivation || (finished ? 'Nominal yang kamu kumpulkan sudah mencapai target album ini.' : `Masih ${moneyDisplay.format(remaining, featured.currency)} lagi menuju targetmu.`))}</p><div class="motivation-actions"><button type="button" class="text-button" data-action="open-album" data-id="${featured.id}">Buka album ${icon('arrow')}</button><span class="motivation-progress">${escapeHtml(label)} terkumpul</span></div></div><div class="motivation-art ${featured.imageVersion ? 'is-photo' : ''}"><img src="${escapeHtml(imageUrl(featured))}" alt=""></div>`;
    }

    function renderRecent() {
        const data = getData();
        const month = today().slice(0, 7);
        const summary = summarizeMonth(data.entries, month);
        $('#recent-title').textContent = 'Catatan bulan ini';
        $('#recent-entries').innerHTML = renderEntries(summary.entries.slice(0, 5), `Belum ada catatan untuk ${formatMonth(month)}.`, 'Tambahkan catatan uang atau buka Riwayat untuk melihat bulan sebelumnya.');
    }


    return { renderSummary, renderMotivation, renderRecent };
}

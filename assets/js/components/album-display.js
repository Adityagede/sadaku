import { escapeHtml } from './dom.js';
import { today } from '../domain/dates.js';
import { calculateProgress, formatProgress } from '../domain/progress.js';
import { moneyDisplay } from '../domain/currency.js';

export function imageUrl(album) {
    if (album.imageUrl) return album.imageUrl;
    return album.imageVersion
        ? `php/api.php?action=image&id=${encodeURIComponent(album.id)}&v=${encodeURIComponent(album.imageVersion)}`
        : 'assets/images/album-cover.svg';
}

export function progress(album) {
    return calculateProgress(album.balance, album.target);
}

export function renderProgress(album) {
    const value = progress(album);
    const label = formatProgress(value);
    return `<progress class="progress-track${value > 0 ? ' has-progress' : ''}${value === 100 ? ' is-complete' : ''}"
        value="${value}" max="100"
        aria-label="Progres ${escapeHtml(album.name)}"
        aria-valuetext="${escapeHtml(label)}; ${moneyDisplay.format(album.balance, album.currency)} dari ${moneyDisplay.format(album.target, album.currency)}">${escapeHtml(label)}</progress>`;
}

export function deadlineText(album) {
    if (album.balance >= album.target) return 'Target tercapai';
    if (!album.deadline) return 'Sesuai ritmemu';
    const days = Math.round((Date.parse(album.deadline) - Date.parse(today())) / 86400000);
    if (days < 0) return 'Lewat tanggal target';
    if (days === 0) return 'Target hari ini';
    return `${days.toLocaleString('id-ID')} hari menuju target`;
}

export function albumCover(album, className = 'album-cover') {
    return `<div class="${className} ${album.imageVersion ? '' : 'is-default'}" data-color="${escapeHtml(album.color)}">
        <img src="${escapeHtml(imageUrl(album))}" alt="" loading="lazy">
        ${album.imageVersion ? '' : `<span class="cover-initial" aria-hidden="true">${escapeHtml(Array.from(album.name)[0].toUpperCase())}</span>`}
    </div>`;
}

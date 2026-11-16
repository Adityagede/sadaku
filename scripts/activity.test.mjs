import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVITY_PAGE_SIZE, DEFAULT_ACTIVITY_FILTERS, activityCsv, activityDayLabel, activityMonths, activityPage, bindActivityMotion, filterActivity } from '../assets/js/activity.js';

test('Riwayat menyertakan semua album dan tahun dengan urutan terbaru', () => {
    const entries = [
        { id: 'a', albumId: 'album-1', date: '2025-12-31', type: 'deposit' },
        { id: 'b', albumId: 'album-2', date: '2026-11-13', type: 'withdrawal', createdAt: '2026-11-13 09:00:00' },
        { id: 'c', albumId: 'album-1', date: '2026-11-13', type: 'deposit', createdAt: '2026-11-13 10:00:00' },
        { id: 'd', albumId: 'album-2', date: '2026-10-01', type: 'deposit' },
    ];
    const original = structuredClone(entries);
    const result = activityPage(entries);
    assert.deepEqual(result.days.map(day => day.date), ['2026-11-13', '2026-10-01', '2025-12-31']);
    assert.deepEqual(result.days[0].entries.map(entry => entry.id), ['c', 'b']);
    assert.equal(result.hasMore, false);
    assert.deepEqual(entries, original, 'Riwayat tidak mengubah data laporan');
});
test('Muat sebelumnya tidak menghilangkan atau menggandakan catatan pada tanggal yang sama', () => {
    const entries = Array.from({ length: 65 }, (_, id) => ({ id: String(id).padStart(3, '0'), date: '2026-11-13' }));
    const first = activityPage(entries);
    assert.equal(first.days[0].entries.length, ACTIVITY_PAGE_SIZE);
    assert.equal(first.hasMore, true);
    const second = activityPage(entries, 60);
    assert.equal(second.days[0].entries.length, 60);
    assert.deepEqual(second.days[0].entries.slice(0, 30), first.days[0].entries);
    const last = activityPage(entries, 90);
    assert.equal(last.days[0].entries.length, 65);
    assert.equal(new Set(last.days[0].entries.map(entry => entry.id)).size, 65);
    assert.equal(last.hasMore, false);
});
test('Kelompok tanggal mengikuti kalender, termasuk pergantian tahun dan Februari', () => {
    const format = date => date;
    assert.equal(activityDayLabel('2026-11-13', '2026-11-13', format), 'Hari ini');
    assert.equal(activityDayLabel('2025-12-31', '2026-01-01', format), 'Kemarin');
    assert.equal(activityDayLabel('2028-02-29', '2028-03-01', format), 'Kemarin');
    assert.equal(activityDayLabel('2026-09-01', '2026-11-13', format), '2026-09-01');
    assert.deepEqual(activityPage([]), { days: [], hasMore: false });
});

test('Kelompok bulan mengikuti tanggal transaksi dan tidak terbelah oleh pemuatan halaman', () => {
    const entries = Array.from({ length: 35 }, (_, id) => ({ id: String(id), date: '2026-01-02' }));
    entries.push({ id: 'older', date: '2025-12-31', createdAt: '2026-01-01 08:00:00' });
    const first = activityMonths(activityPage(entries).days);
    const all = activityMonths(activityPage(entries, 60).days);
    assert.deepEqual([...first.keys()], ['2026-01']);
    assert.deepEqual([...all.keys()], ['2026-01', '2025-12']);
    assert.equal(all.get('2026-01').length, 35);
    assert.equal(all.get('2025-12')[0].id, 'older');
});

test('Pencarian dan filter memeriksa semua catatan sebelum dipaginasi', () => {
    const albums = [{ id: 'camera', name: 'Kamera Baru' }, { id: 'travel', name: 'Liburan' }];
    const entries = Array.from({ length: 30 }, (_, id) => ({
        id: String(id), albumId: 'travel', type: 'deposit', date: '2026-11-02', note: 'Beli lensa'
    }));
    entries.push({ id: 'target', albumId: 'camera', type: 'withdrawal', date: '2026-10-02', note: 'Beli lensa' });
    entries.push({ id: 'other-month', albumId: 'camera', type: 'withdrawal', date: '2026-09-02', note: 'Beli lensa' });
    const matches = filterActivity(entries, albums, {
        ...DEFAULT_ACTIVITY_FILTERS, query: ' KAMERA   lensa ', month: '2026-10', type: 'withdrawal', albumId: 'camera'
    });
    assert.deepEqual(matches.map(entry => entry.id), ['target']);
    assert.equal(filterActivity(entries, albums, { ...DEFAULT_ACTIVITY_FILTERS, query: 'penarikan' }).length, 2);
});

test('CSV berisi semua hasil secara urut, nominal bertanda, dan teks yang aman diimpor', () => {
    const albums = [{ id: 'a', name: '=2+2' }];
    const entries = [
        { id: 'old', albumId: 'a', type: 'deposit', date: '2026-10-02', amount: 2000, note: 'Koma, "kutip"\nbaris' },
        { id: 'new', albumId: 'a', type: 'withdrawal', date: '2026-11-02', amount: 500, note: '  +SUM(1,2)' }
    ];
    assert.equal(activityCsv(entries, albums),
        '\uFEFFTanggal,Album,Jenis,Nominal (Rp),Catatan\r\n'
        + "2026-11-02,\"'=2+2\",Penarikan,-500,\"'  +SUM(1,2)\"\r\n"
        + "2026-10-02,\"'=2+2\",Setoran,2000,\"Koma, \"\"kutip\"\"\nbaris\"\r\n");
});

function motionFixture(t, reduced = false) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: reduced }) } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
    const animations = [];
    const item = { open: false, offsetHeight: 201, clientHeight: 200,
        querySelector: () => ({}), getBoundingClientRect: () => ({ height: item.open ? 201 : 101 }),
        animate: () => { const animation = { cancelled: false, cancel() { this.cancelled = true; } }; animations.push(animation); return animation; },
    };
    const summary = { closest: () => item, getBoundingClientRect: () => ({ height: 100 }) };
    let click;
    bindActivityMotion({ addEventListener: (name, handler) => { click = handler; } });
    return { item, animations, click: () => {
        const event = { defaultPrevented: false, target: { closest: () => summary }, preventDefault() { this.defaultPrevented = true; } };
        click(event);
        return event;
    } };
}
test('Rincian tetap terbuka selama transisi tutup lalu kembali ke keadaan native', t => {
    const { item, animations, click } = motionFixture(t);
    assert.equal(click().defaultPrevented, true);
    animations[0].onfinish();
    assert.equal(item.open, true);
    click();
    assert.equal(item.open, true, 'Isi tetap tersedia selama animasi menutup');
    animations[1].onfinish();
    assert.equal(item.open, false);
    assert.equal(animations[1].cancelled, true, 'Efek animasi dibersihkan setelah selesai');
});
test('Ketukan cepat membalik transisi tanpa terkunci; preferensi gerakan memakai perilaku native', t => {
    const { item, animations, click } = motionFixture(t);
    click();
    click();
    assert.equal(animations[0].cancelled, true);
    animations[0].onfinish();
    animations[1].onfinish();
    assert.equal(item.open, false);
    globalThis.window.matchMedia = () => ({ matches: true });
    assert.equal(click().defaultPrevented, false);
    assert.equal(animations.length, 2, 'Tidak menambah animasi saat pengurangan gerakan aktif');
});

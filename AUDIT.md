# Audit struktur dan kebersihan ? 17 November 2026

Audit ini mempertahankan desain yang telah dipulihkan dan fitur mata uang per album. Snapshot sumber sebelum perapian tersimpan lokal pada `.test-storage-refactor/before.json`; database utama dan berkas konfigurasi pribadi tidak disentuh.

## Hasil perapian

- Entry browser dipindahkan dari `assets/js/main.js` ke `assets/js/app.js`. Ukurannya turun dari 1.235 menjadi 403 baris; pengendali halaman/formulir serta komponen bersama kini berada di modul masing-masing.
- Aturan bisnis berada di `domain/`; IndexedDB, adapter sumber, cadangan, dan notifikasi berada di `data/`. Animasi DOM aktivitas dipisahkan dari pengolahan aktivitas domain. Terdapat 32 modul browser, semuanya terhubung ke entry aplikasi atau script tema.
- Sebanyak 21 berkas pengujian/helper dipindahkan dari `scripts/` ke `tests/`. Impor, perintah npm, runner MySQL, router, konteks Docker, daftar cache offline, dan dokumentasi ikut diperbarui. Jalur `tests/` diblokir untuk Apache dan tidak masuk daftar router publik.
- Tiga impor yang tidak digunakan dan dependensi/ekspor pengendali yang tidak diperlukan dihapus. Tidak ada penghapusan aturan keuangan, fitur pemulihan, atau dependensi runtime.
- Cache npm lokal serta hasil konsep dan salinan redesign yang dibatalkan dihapus setelah pemeriksaan path. Total berkas yang dibersihkan: **78.879.580 byte (sekitar 75,2 MiB)**. Dependensi aktif `node_modules/` dan `vendor/` dipertahankan. Bukti audit lama dan snapshot perapian dipertahankan untuk pemulihan.

## Verifikasi

- **114 tes JavaScript lulus**, termasuk alur DOM yang kini memuat graf ES modules sebenarnya di jsdom, mata uang campuran, persistensi, pemulihan, dan offline.
- **117 pemeriksaan API lokal + 113 simulasi produksi lulus** dengan MySQL sementara. Pengiriman pengingat, deduplikasi, jeda, retry, dan langganan kedaluwarsa lulus.
- Tes PHP pengaturan, **10 pemeriksaan CSRF**, validasi rencana/notifikasi, serta enkripsi/VAPID dengan HTTP mock lulus.
- Build CSS lulus. Keempat berkas CSS (termasuk hasil build) **identik** dengan snapshot sebelum perapian. HTML **identik setelah menormalkan dua perubahan jalur script**.
- Pemeriksaan sumber memvalidasi sintaks, impor, keterjangkauan modul, serta registrasi router/cache offline. Tidak ada modul browser yang tidak terhubung.

Pemeriksaan visual browser dan build Docker nyata tidak diklaim pada audit struktur ini. Tidak ada perubahan styling atau susunan HTML; simulasi produksi memeriksa filesystem dan API melalui PHP.

Panduan developer: [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md).

---

# Audit kode Sadaku — 16 November 2026

Audit dilakukan terhadap working tree saat ini, termasuk perubahan lokal yang sudah ada sebelum audit. Perubahan tersebut dipertahankan; audit tidak melakukan commit atau mengubah staging Git.

## Alur yang diperiksa

| Bagian | Alur dan tanggung jawab |
| --- | --- |
| Halaman dan tema | `index.html` memuat `theme.js`, stylesheet, lalu modul `main.js`. Tema diterapkan sebelum aplikasi dimuat. |
| Navigasi | `navigation.js` mengatur Ringkasan, Album, Riwayat, Statistik, detail album, dan halaman Pengaturan melalui hash URL. Filter Statistik dan Riwayat terpisah. |
| Album dan catatan | Form di `main.js` mengirim FormData ke `php/api.php`. PHP memvalidasi token CSRF dan input, lalu menulis ke MySQL dalam transaksi dengan penguncian album. |
| Saldo dan tanggal | `database.php` menghitung saldo dari catatan. Perubahan yang membuat saldo historis negatif ditolak. Catatan baru memakai tanggal server WIB; edit mempertahankan tanggal dan album asli. |
| Tampilan setelah simpan | API mengembalikan snapshot album/catatan; `acceptSnapshot()` memperbarui Ringkasan, album, Riwayat, Statistik, serta detail. |
| Laporan | `monthly.js` menghitung periode, perbandingan, dan konsistensi; `monthly-view.js` membuat tampilan. `activity.js` menangani filter, pengelompokan, pemuatan bertahap, dan CSV. |
| Rencana menabung | Album beserta rencana disimpan sekaligus. `saving-plan.js` dan `php/saving-plan.php` menghitung kalender jadwal; rencana tidak langsung mengubah saldo. |
| Pengingat | `reminders.js` mendaftarkan perangkat melalui API; `send-reminders.php` mengecek jadwal dan mengirim Web Push melalui `push.php`. `sw.js` menampilkan notifikasi dan membuka album. |
| Penyajian aplikasi | `scripts/serve.php` membatasi file publik pada server lokal. Docker memakai direktori `public` dan wrapper `deployment/api.php`. |

## Perubahan yang dilakukan

1. **Menghapus 82 aturan CSS lama terkait 39 nama kelas yang tidak dipakai.** Referensi diperiksa dengan batas nama kelas utuh terhadap `index.html` dan seluruh 11 modul JavaScript, termasuk template tampilan. Contohnya `.statistics-filter-panel`, `.period-metric`, `.month-bar`, `.comparison-box`, `.history-summary`, dan `.app-footer`.
   - Aturan dihapus dari `assets/css/tailwind.css` dan `assets/css/interface.css`; dua selector terkait juga dihapus dari `assets/css/theme.css`.
   - CSS dibangun ulang melalui compiler project. Ukuran `style.css` berubah dari **85.976 menjadi 63.312 byte**, turun **22.664 byte / sekitar 26,4%**.
   - Perbandingan AST CSS terhadap build sebelum pembersihan memastikan **269 aturan aktif tetap identik**, termasuk isi aturan bersarangnya. Perubahan pada deklarasi global hanya membuang `--container-2xl`, `--tw-divide-y-reverse`, dan `--tw-divide-x-reverse` yang sudah tidak dirujuk oleh CSS hasil build.
   - Kelas dinamis seperti `.report-metric-net` dan `.report-metric-withdrawal` tetap dipertahankan.
2. **Mengurangi pembacaan berulang di penjadwal pengingat.** Query awal di `scripts/send-reminders.php` sekarang hanya mengambil ID langganan. Isi langganan tetap dibaca ulang dengan `FOR UPDATE` sebelum pengiriman, seperti sebelumnya. Pemeriksaan status terbaru, penguncian, dan deduplikasi tetap berjalan.

Tidak ada file aplikasi, tabel, data pengguna, endpoint, atau dependensi project yang dihapus. Dependensi npm yang sudah tercantum di `package.json` dipasang untuk menjalankan build; manifest dan versi dependensi tidak diubah.

## Kode yang dipertahankan

- Seluruh fungsi JavaScript tingkat modul dan fungsi PHP yang ditelusuri masih memiliki referensi. Pencarian fungsi tanpa pemanggil tidak menghasilkan kandidat penghapusan yang jelas pada cakupan ini.
- Endpoint `save_plan` tidak dipanggil oleh UI saat ini karena rencana disimpan melalui `save_album`. Endpoint masih memiliki kontrak API dan tes integrasi tersendiri; ketiadaan pemanggil UI belum cukup untuk menyatakan endpoint aman dihapus.
- `sw.js`, modul pengingat, dan dependensi Composer Web Push diperlukan oleh alur pengingat meskipun tidak terlihat sebagai fitur pada setiap halaman.
- Script setup, fixture tanggal historis, pengujian, dan deployment tetap diperlukan untuk pengembangan atau operasi; tidak semuanya memiliki pemanggil langsung dari halaman.
- Biometrik dan alarm Android masih ditandai **Belum tersedia** di UI dan dokumentasi. Tidak ditemukan implementasi fitur tersebut untuk dinyatakan berfungsi.

## Temuan untuk tindak lanjut

| Temuan | Dampak dan keputusan |
| --- | --- |
| `.month-chart` masih memperoleh `grid-template-columns: repeat(6, ...)` dari CSS dasar; stylesheet antarmuka menambahkan kolom otomatis tanpa meresetnya. | Berpotensi menyisakan ruang kolom saat grafik hanya berisi 1–5 bulan. Ini temuan dari pembacaan CSS; dampak visual belum dikonfirmasi. Aturan aktif dipertahankan agar audit ini tidak mengubah desain tanpa pemeriksaan visual. |
| `npm run check` hanya memeriksa sintaks `main.js`. | Modul lain dapat luput jika perintah ini dipakai sendiri. Dalam audit ini seluruh file `.js`/`.mjs` di `assets/js` dan `scripts` diperiksa secara terpisah dan lulus. |
| Sebagian besar interaksi DOM di `main.js` belum diuji melalui browser nyata dalam audit ini. | Tes modul dan API lulus, tetapi belum cukup untuk menjamin seluruh interaksi, fokus dialog, atau layout perangkat. |

## Verifikasi

Pemeriksaan awal dilakukan sebelum perubahan; pemeriksaan terkait diulang setelah perubahan.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit test JavaScript: aktivitas, konteks album, nominal, laporan, navigasi, progres, perangkat, rencana, dan tema | **68/68 lulus**, sebelum dan setelah perubahan |
| Integrasi API dengan MySQL sementara | **117 pemeriksaan lokal + 113 pemeriksaan mode produksi simulasi lulus**, sebelum dan setelah perubahan |
| Pengingat dengan MySQL dan pengirim simulasi | Pengiriman, deduplikasi, jeda, pemenuhan setoran, retry, serta penghapusan langganan kedaluwarsa lulus setelah perubahan query |
| Sintaks PHP | Seluruh file PHP di `php`, `scripts`, dan `deployment` lulus; penjadwal yang berubah diperiksa ulang |
| Tes PHP tambahan | Pengaturan publik, 10 pemeriksaan CSRF produksi, validasi rencana/langganan, serta VAPID/enkripsi dengan HTTP mock lulus pada pemeriksaan awal |
| Build dan sintaks JavaScript | `npm run build`, `npm run check`, dan pemeriksaan seluruh file JavaScript lulus |
| Pemeriksaan statis tambahan | Import modul lokal tersedia; nama kelas yang dihapus tidak dirujuk runtime; aturan CSS aktif dipertahankan; perubahan query sesuai cakupan; `git diff --check` lulus |

Tes integrasi memakai database sementara terpisah melalui `tests/test-mysql.mjs`. Audit tidak menjalankan setup, CRUD, atau pengiriman push terhadap database utama. Notifikasi ke perangkat nyata dan container Docker/Caddy di hosting tidak diuji. Mode produksi di atas adalah simulasi layout filesystem dan konfigurasi API melalui server PHP pengujian.

Pemeriksaan visual belum selesai: browser automation melaporkan **“The browser access host is unavailable”**, dan jalur observasi aplikasi native tidak memberikan tampilan browser yang dapat diverifikasi. Tidak ada kesimpulan visual yang diklaim dari percobaan tersebut.

Snapshot lima file sebelum perubahan dan bukti pemeriksaan tersimpan lokal di `.test-storage-audit-20261116/`, yang diabaikan Git. Snapshot berisi keadaan tepat sebelum audit, sehingga perubahan lokal sebelumnya dapat dipertahankan bila pembersihan ini perlu dibatalkan.

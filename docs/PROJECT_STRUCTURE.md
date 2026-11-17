# Panduan struktur proyek Sadaku

Panduan ini menjelaskan lokasi perubahan untuk developer yang baru bergabung. Aturan produk dan pengerjaan tetap berada di [SOP](../SOP.md); cara menjalankan aplikasi ada di [README](../README.md).

## Bentuk aplikasi

Sadaku memakai satu dokumen HTML, JavaScript ES modules, dan navigasi hash seperti `#riwayat`. Bagian tampilan serta navbar/footer bersama ditulis sekali di `index.html`. Berpindah menu tidak memuat dokumen baru. Pemisahan file JavaScript tidak mengubah susunan HTML, desain, nama database IndexedDB, atau format data pengguna.

```text
/
├── index.html                 # Tampilan, navbar/footer bersama, dan dialog
├── sw.js                      # Daftar aset publik untuk offline dan Web Push
├── assets/
│   ├── js/
│   │   ├── app.js             # Startup, state aplikasi, routing, dan penghubung modul
│   │   ├── pages/             # Pengendali tampilan serta formulir per tugas
│   │   │   ├── overview.js
│   │   │   ├── albums.js
│   │   │   ├── album-form.js
│   │   │   ├── entry-form.js
│   │   │   ├── history.js
│   │   │   ├── statistics.js
│   │   │   ├── statistics-view.js
│   │   │   ├── settings.js
│   │   │   └── backup.js
│   │   ├── components/        # DOM, navigasi, menu, dialog, input uang, dan daftar
│   │   ├── domain/            # Aturan tabungan, mata uang, kalender, dan laporan
│   │   └── data/              # IndexedDB, adapter sumber, cadangan, dan notifikasi
│   ├── css/
│   │   ├── tailwind.css       # Sumber styling dasar dan komponen
│   │   ├── style.css          # Hasil build; jangan diedit langsung
│   │   ├── interface.css      # Styling tambahan antarmuka
│   │   └── theme.css          # Tema terang/gelap
│   └── images/
├── php/                       # API dan pemrosesan server pribadi
├── database/schema.sql        # Skema tabel tanpa data pengguna
├── scripts/                   # Build, pemeriksaan sumber, server, setup, dan scheduler
├── tests/                     # Tes JavaScript, PHP, API, serta runner MySQL sementara
├── deployment/                # Konfigurasi dan pembungkus runtime produksi
├── docs/                      # Panduan untuk developer
├── README.md
├── SOP.md
├── ARCHITECTURE.md             # Kondisi sekarang dan rancangan tahap berikutnya
├── AUDIT.md                    # Temuan dan bukti pemeriksaan
└── DEPLOYMENT.md
```

## Mulai dari file yang sesuai

| Perubahan | Lokasi utama |
| --- | --- |
| Ringkasan saldo dan target terdekat | `assets/js/pages/overview.js` |
| Kartu dan detail album | `assets/js/pages/albums.js` |
| Buat/ubah album dan rencana | `assets/js/pages/album-form.js` |
| Catat/ubah setoran atau penarikan | `assets/js/pages/entry-form.js` |
| Pencarian, filter, dan ekspor aktivitas | `assets/js/pages/history.js` |
| Cakupan dan interaksi Statistik | `assets/js/pages/statistics.js` |
| HTML laporan dan grafik | `assets/js/pages/statistics-view.js` |
| Pengaturan tema/notifikasi | `assets/js/pages/settings.js` |
| Alur cadangan/pemulihan dan pergantian sumber | `assets/js/pages/backup.js` |
| Tampilan baris aktivitas yang dipakai di beberapa halaman | `assets/js/components/activity-list.js` |
| Menu titik tiga dan dialog | `assets/js/components/app-menu.js`, `dialog.js` |
| Navbar/footer dan struktur halaman | `index.html`; perilaku rute di `components/navigation.js` |
| Saldo historis dan validasi wallet | `assets/js/domain/wallet.js` |
| Skala dan format mata uang | `assets/js/domain/currency.js` |
| Perhitungan laporan/jadwal | `assets/js/domain/monthly.js`, `saving-plan.js` |
| Penyimpanan perangkat | `assets/js/data/local-store.js` |
| Pemilihan perangkat/server | `assets/js/data/data-source.js` |
| Format dan validasi berkas cadangan | `assets/js/data/backup.js` |
| CRUD server pribadi | `php/api.php`, `php/database.php` |

## Hubungan antarmodul

- `domain/` mengolah nilai dan aturan; jangan mengimpor pengendali halaman atau mengakses DOM di sini.
- `data/` mengurus penyimpanan dan koneksi, memakai validasi dari domain.
- `components/` menyediakan perilaku serta tampilan bersama. `theme.js` dimuat lebih awal sebagai script biasa agar tema diterapkan sebelum CSS.
- `pages/` memakai komponen, perhitungan domain, serta dependensi yang diberikan oleh `app.js`.
- `app.js` membuat state dan menghubungkan modul. Pengendali mendapat `getData()` agar membaca snapshot terbaru setelah data diganti. State khusus seperti filter Statistik, pratinjau cadangan, atau URL foto draft dimiliki modul yang menggunakannya.

Satu halaman tidak mengimpor dan mengubah state halaman lain secara langsung. Gunakan dependensi fungsi yang diberikan saat inisialisasi. Pertahankan aturan mata uang per album, pemulihan atomik, dan pemisahan data perangkat/server.

## Pemeriksaan setelah perubahan

```sh
npm run check
npm run test:unit
npm run build
```

`check` memeriksa sintaks semua modul browser, tujuan impor, modul yang tidak terhubung, serta daftar router/cache offline. Tes UI memuat graf ES modules sebenarnya dalam jsdom; Node memerlukan flag `--experimental-vm-modules`, yang sudah disertakan dalam perintah npm. Pemeriksaan ini tidak menggantikan pemeriksaan visual browser.

Untuk perubahan server atau router, jalankan tes integrasi terisolasi:

```sh
npm test -- "C:/laragon/bin/mysql/mysql-8.4.3-winx64"
```

Runner membuat instance MySQL sementara. Jangan menjalankan tes CRUD pada database utama. Tes PHP lainnya tersedia melalui `npm run test:settings`, `npm run test:csrf`, dan `npm run test:plans`.

Jika menambahkan modul browser, daftarkan jalurnya dalam `scripts/serve.php` dan `sw.js`, naikkan versi cache, lalu jalankan `npm run check`. Konteks Docker sudah mengizinkan subfolder JavaScript; file server, konfigurasi pribadi, dan tes tetap bukan aset publik.

## File lokal dan dependensi

`node_modules/` dan `vendor/` adalah dependensi aktif yang dikelola npm/Composer. Jangan menyunting isinya. `.env` berisi konfigurasi lokal dan tidak masuk Git. `.test-storage-*` menyimpan bukti pemeriksaan atau snapshot pemulihan lokal, juga diabaikan Git. Cache npm dapat dibuat ulang; cache bukan source code aplikasi.

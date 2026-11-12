# Sadaku

Aplikasi pribadi untuk mencatat uang dan menabung menuju album target. Stack: HTML, Tailwind CSS, JavaScript, PHP, dan MySQL.

## Menyiapkan server dan database

Kebutuhan: PHP 8.1 atau lebih baru dengan ekstensi pdo_mysql, mbstring, dan fileinfo; MySQL 8 atau lebih baru. PHP menangani aplikasi, sedangkan MySQL menyimpan album, gambar, dan catatan uang.

1. Nyalakan MySQL melalui Laragon, XAMPP, atau layanan MySQL yang kamu pakai. Jika memakai `npm run dev`, web server PHP dijalankan lewat terminal; Apache tidak perlu dinyalakan.
2. Buat database melalui phpMyAdmin atau alat pengelola MySQL:

   ```sql
   CREATE DATABASE sadaku
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci;
   ```

3. Sesuaikan `.env` di root proyek. Konfigurasi awalnya:

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=sadaku
   DB_USERNAME=root
   DB_PASSWORD=""
   ```

   `root` dan password kosong merupakan contoh untuk lingkungan lokal. Isi sesuai akun MySQL yang benar. Jika password mengandung spasi atau karakter khusus, bungkus dengan tanda kutip. Nilai dibaca secara literal, tanpa interpolasi variabel. Environment variable dari server mengungguli nilai file `.env`.

   `.env` sudah disiapkan di komputer ini dan diabaikan oleh Git. Pada salinan proyek baru, salin `.env.example` menjadi `.env` terlebih dahulu. Password cukup diisi di file lokal, bukan di HTML atau JavaScript.

4. Buat tabel dari root proyek:

   ```sh
   php scripts/setup-database.php
   ```

   Perintah ini membuat tabel `albums` dan `entries` di database yang dipilih. Database perlu dibuat terlebih dahulu. Tabel yang sudah ada tidak dihapus. Alternatifnya, pilih database di phpMyAdmin lalu impor `database/schema.sql`.

5. Periksa koneksi:

   ```sh
   php scripts/check-database.php
   ```

   Hasil yang diharapkan: `Koneksi MySQL berhasil. Tabel albums dan entries tersedia.`

6. Jalankan aplikasi:

   ```sh
   npm run dev
   ```

   Buka **http://127.0.0.1:8080**. Terminal server tetap berjalan selama aplikasi dipakai. Tekan Ctrl+C untuk menghentikannya.

Tanpa npm, server juga dapat dijalankan dengan:

```sh
php -d upload_max_filesize=5M -d post_max_size=6M -S 127.0.0.1:8080 scripts/serve.php
```

Jalankan melalui router tersebut agar hanya file publik yang dapat diakses. Membuka HTML langsung atau melalui Live Server saja tidak menjalankan API PHP.

Alur koneksi: **browser → API PHP → MySQL**. PHP membaca `.env` dan menghubungkan database menggunakan PDO; lihat [dokumentasi koneksi PDO MySQL](https://www.php.net/manual/en/ref.pdo-mysql.connection.php). Browser menerima data aplikasi, tanpa menerima password database.

## Jika muncul akses MySQL ditolak

Pesan ini terjadi saat login database, sebelum tabel dapat dibuat. Pembuatan tabel tidak memperbaiki username atau password yang ditolak. Gunakan akun, host, serta port yang sama dengan koneksi MySQL yang sudah berhasil di alat pengelola database.

Urutan pemeriksaan:

```sh
php scripts/check-database.php --config
php scripts/check-database.php --connection
php scripts/setup-database.php
php scripts/check-database.php
```

`--config` menampilkan konfigurasi efektif dan status password kosong atau terisi, tanpa menampilkan password. Jika ada environment variable server yang mengungguli `.env`, nama variabelnya akan ditampilkan. `--connection` memeriksa login dan pemilihan database tanpa mensyaratkan tabel sudah ada.

Lanjutkan ke perintah berikutnya setelah perintah sebelumnya berhasil. Jika login ditolak, perbaiki `.env` terlebih dahulu. `DB_PASSWORD=""` hanya benar jika akun MySQL tersebut memang tidak memakai password.

Untuk memeriksa login langsung dari terminal MySQL/Laragon, sesuaikan host, port, dan username dengan `.env`:

```sh
mysql --protocol=TCP -h 127.0.0.1 -P 3306 -u root -p
```

Masukkan password pada prompt terminal. Jika login ini juga ditolak, akun MySQL perlu diperbaiki melalui pengelola server; menjalankan setup tabel berulang tidak menyelesaikan penolakan login. Lihat [panduan koneksi MySQL](https://dev.mysql.com/doc/refman/8.4/en/problems-connecting.html).

Perintah `setup-database.php` adalah pemasangan tabel awal proyek ini, sebagai pengganti langkah migrasi awal yang biasanya dijalankan lewat framework. Perintah tersebut memakai `CREATE TABLE IF NOT EXISTS`, sehingga tidak menghapus tabel dan data yang sudah ada. Perubahan struktur kolom di masa depan memerlukan script migrasi baru; mengedit `schema.sql` saja tidak mengubah tabel lama.

## Alur penggunaan

1. Buat album dengan nama dan nominal target.
2. Pilih warna atau unggah foto sendiri (JPG, PNG, WebP; maksimal 5 MB). Tanggal target dan alasan menabung bersifat opsional.
3. Buka album, lalu tambahkan setoran atau penarikan.
4. Pantau saldo, sisa target, dan riwayat. Ubah atau hapus album dan catatan melalui tombol yang tersedia.

Saldo dihitung dari catatan tersimpan. Perubahan yang membuat saldo negatif di bagian mana pun dalam riwayat ditolak. Perubahan pada album yang sama dijalankan dalam transaksi dengan penguncian album. Menghapus album ikut menghapus catatan di dalamnya setelah konfirmasi.

Aplikasi dimulai tanpa data contoh. Data serta gambar tersimpan dalam MySQL dan bertahan setelah halaman ditutup. Backup dilakukan melalui database MySQL.

## Laporan dan riwayat bulanan

Navigasi terdiri dari **Ringkasan**, **Album target**, **Riwayat**, dan **Statistik**. Ringkasan menampilkan kondisi tabungan saat ini, album, dan maksimal lima catatan terbaru bulan berjalan dari seluruh album.

Pada **Statistik**, pilih periode dan semua album atau satu album untuk melihat total setoran, penarikan, serta tabungan bersih. Grafik menampilkan enam bulan kalender terakhir termasuk bulan ini; tekan batang untuk memilih bulan. Istilah Penarikan merujuk pada uang yang diambil dari tabungan, bukan otomatis pengeluaran belanja.

Perbandingan memakai nominal setoran. Untuk bulan berjalan, tanggal 1 sampai hari ini dibandingkan dengan rentang tanggal yang sama pada bulan sebelumnya. Jika bulan sebelumnya lebih pendek, rentangnya berhenti pada hari terakhir bulan tersebut. Untuk bulan selesai, perbandingan memakai total bulan penuh. Pembanding nol tidak ditampilkan sebagai persentase, dan riwayat yang belum cukup diberi keterangan.

Rutinitas menampilkan jumlah bulan dengan setoran dari maksimal enam bulan selesai terakhir sejak awal riwayat, serta jumlah bulan menabung berturut-turut. Bulan ini yang masih kosong tidak memutus rentetan sebelumnya. Nominal setoran yang turun atau adanya penarikan tidak menghapus fakta bahwa ada setoran pada bulan tersebut.

Halaman **Riwayat** berfokus pada daftar transaksi dalam bulan terpilih, dikelompokkan per tanggal. Tersedia jumlah catatan, ringkasan setoran/penarikan/tabungan bersih, serta tombol ubah dan hapus. Riwayat pada detail album memiliki pilihan bulan sendiri.

Pilihan periode dan album Statistik serta Riwayat terpisah dan tetap tersimpan saat berpindah menu selama aplikasi dibuka. Tombol **Lihat catatan periode ini** dari Statistik menyalin pilihan tersebut ke Riwayat. Mengubah filter Riwayat sesudahnya tidak ikut mengubah Statistik. Tautan **Lihat riwayat** di Ringkasan secara sengaja membuka bulan ini untuk seluruh album.

Pilihan **Bulan ini** mengikuti pergantian kalender dalam zona waktu Asia/Jakarta. Contohnya, saat Desember dimulai, pilihan ini membuka Desember dan November tampil sebagai **November 2026**. Jika pengguna sengaja memilih November, pilihan itu tetap di November. Halaman mengecek pergantian tanggal setiap menit dan saat tab kembali aktif.

Riwayat lama tetap dapat dipilih melampaui enam bulan, termasuk bulan kosong di antaranya. Transaksi bertanggal 30 November yang dimasukkan pada 1 Desember tetap berada di November. Mengedit atau menghapus catatan menghitung ulang laporan; menghapus album juga menghapus catatan serta kontribusinya pada laporan, sesuai alur CRUD.

Fitur bulanan dihitung dari catatan yang sudah tersimpan. Tidak diperlukan tabel atau migrasi database baru.

## Struktur

```text
.env                       Konfigurasi lokal; tidak masuk Git
.env.example               Contoh konfigurasi tanpa kredensial pribadi
index.html                 Halaman utama aplikasi
assets/css/tailwind.css    Sumber styling
assets/css/style.css       Hasil build Tailwind
assets/js/main.js          Navigasi, tampilan, formulir, dan permintaan API
assets/js/navigation.js    Rute menu dan pilihan filter halaman yang terpisah
assets/js/progress.js      Perhitungan dan format persentase target
assets/js/monthly.js       Perhitungan laporan, perbandingan, dan kalender bulanan
assets/js/monthly-view.js  Tampilan ringkasan dan grafik bulanan
assets/images/             Ikon dan sampul ilustrasi bawaan
database/schema.sql       Struktur tabel MySQL
php/environment.php       Pembaca konfigurasi environment
php/database.php          Koneksi PDO, pembacaan data, dan validasi saldo
php/api.php               Endpoint CRUD dan gambar album
scripts/setup-database.php Pemasangan tabel
scripts/check-database.php Pemeriksaan koneksi dan keberadaan tabel
scripts/build-css.mjs      Build CSS dengan compiler resmi Tailwind
scripts/serve.php          Router server lokal
scripts/test-mysql.mjs     Penyiapan MySQL sementara untuk pengujian
scripts/test-api.mjs       Pengujian CRUD melalui HTTP
```

Folder `lib/` ditambahkan saat library browser diperlukan. Versi ini menggunakan interaksi JavaScript dan CSS bawaan.

## Pengembangan dan pengujian

CSS hasil build sudah disertakan. Untuk mengubah styling:

```sh
npm install
npm run build
```

Pemeriksaan sintaks dan database:

```sh
npm run check
npm run test:progress
npm run test:monthly
npm run test:navigation
npm run db:check
php -l php/api.php
php -l php/database.php
php -l php/environment.php
```

Pengujian integrasi membutuhkan direktori instalasi MySQL yang memiliki `bin/mysqld`, `bin/mysql`, dan `bin/mysqladmin`. Contoh instalasi Laragon di komputer ini:

```sh
npm test -- "C:/laragon/bin/mysql/mysql-8.4.3-winx64"
```

Pengujian menjalankan instance MySQL dan server PHP sementara di loopback dengan database terpisah. Konfigurasi pengujian tidak mengubah `.env` atau database utama. Pengujian memeriksa CRUD, unggahan gambar, persistensi, validasi saldo, CSRF, serta pemblokiran file privat. Server serta data pengujian dibersihkan setelah selesai.

`test:progress` memeriksa setoran kecil, perubahan saldo, target tercapai, serta persentase yang mendekati nol dan 100%. Setoran Rp1.000 pada target Rp25 juta ditampilkan sebagai 0,004%. Garis memiliki penanda minimum saat saldo positif agar tetap terlihat pada layar kecil; nilai persentase tetap dihitung dari nominal sebenarnya.

## Lingkungan pemakaian

Versi ini untuk satu pengguna di server lokal. Belum ada sistem akun; semua browser yang mengakses server yang sama melihat data yang sama. Server pengembangan hanya terikat pada `127.0.0.1`.

Untuk Apache, aktifkan `mod_rewrite` dan `AllowOverride All` agar aturan `.htaccess` berlaku. Pada hosting, isi konfigurasi database yang diberikan penyedia hosting melalui environment server atau `.env`. Penyiapan akses banyak pengguna merupakan pekerjaan terpisah.

Tanggal pencatatan menggunakan zona waktu Asia/Jakarta. Mata uang berupa rupiah bulat.

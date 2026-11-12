# SOP Proyek Sadaku

Dokumen ini menjadi acuan pengerjaan dan pembaruan Sadaku, aplikasi pribadi untuk mencatat uang dan menabung melalui album target.

## 1. Arah pengerjaan

- Fokus pada aplikasi pencatatan uang dan album target pribadi sesuai kebutuhan yang disepakati.
- Kerjakan permintaan yang sedang dibahas sampai selesai dan diperiksa.
- Jangan menambahkan fitur, halaman, framework, atau dependensi di luar kebutuhan tanpa membahas alasannya terlebih dahulu.
- Jika ada informasi yang belum jelas, periksa konteks proyek. Tanyakan hanya jika jawabannya memengaruhi fungsi atau arah desain.
- Jangan mengubah bagian yang tidak berkaitan dengan pekerjaan tanpa alasan yang jelas.

## 2. Stack

- HTML untuk struktur halaman.
- Tailwind CSS untuk styling.
- JavaScript untuk interaksi di browser.
- PHP untuk pemrosesan di server.
- `index.html` di root menjadi halaman masuk default, berisi antarmuka aplikasi Sadaku.
- PHP memproses API dan menyimpan data secara permanen dalam MySQL menggunakan PDO.
- Konfigurasi host, port, nama database, username, dan password dibaca dari `.env`. `.env` tidak dimasukkan ke Git; `.env.example` menjadi contoh konfigurasi tanpa kredensial pribadi.
- Struktur tabel disimpan dalam `database/schema.sql`. Jalankan `php scripts/setup-database.php` setelah database dibuat. Aplikasi tidak membuat tabel pada setiap permintaan.
- Jalankan server lokal melalui router `scripts/serve.php`. Router hanya menyajikan halaman, aset yang diizinkan, dan endpoint API.
- Jangan menambahkan framework aplikasi atau alat build lain tanpa kebutuhan yang disepakati. Proses build Tailwind dapat digunakan untuk menghasilkan CSS lokal.

## 3. Struktur folder

Struktur berikut menjadi acuan. Buat folder dan file saat memang dibutuhkan; jangan mengisi proyek dengan placeholder.

```text
/
├── index.html
├── SOP.md
├── assets/
│   ├── css/
│   │   ├── tailwind.css   # Sumber styling dan konfigurasi CSS yang diperlukan
│   │   └── style.css      # Hasil build untuk dipakai halaman
│   ├── js/               # JavaScript milik aplikasi
│   └── images/           # Gambar yang digunakan
├── lib/                  # Library pihak ketiga yang disimpan lokal
├── pages/                # Halaman aplikasi selain landing page
└── php/                  # Pemrosesan PHP dan kode server bersama
```

- Pisahkan kode buatan proyek dari library pihak ketiga.
- Simpan library dalam subfolder bernama jelas, misalnya `lib/aos/` atau `lib/swiper/`, hanya jika digunakan.
- Gunakan nama file yang menjelaskan fungsinya dan ikuti pola penamaan yang konsisten.
- `.env`, kode konfigurasi PHP, skema SQL, serta script pemeliharaan tidak termasuk rute publik router dan diblokir oleh `.htaccess` pada Apache.

## 3a. Alur aplikasi yang disepakati

- Nama aplikasi: Sadaku. Navigasi utama terdiri dari Ringkasan, Album target, Riwayat, dan Statistik, dengan empat tombol pada navigasi ponsel.
- Pengguna membuat album sendiri, misalnya target iPhone atau sepeda motor, dengan nama dan nominal target.
- Album mendukung foto sampul pribadi, warna sampul, tanggal target opsional, dan alasan menabung opsional.
- Album dapat dilihat, dibuat, diubah, dan dihapus. Hapus album memerlukan konfirmasi karena catatan di dalamnya ikut dihapus.
- Setiap catatan uang berada di satu album dan memuat jenis setoran atau penarikan, nominal, tanggal, serta keterangan opsional.
- Catatan dapat dilihat, dibuat, diubah, dan dihapus. Saldo serta progres dihitung dari catatan tersimpan, bukan diisi manual.
- Perubahan catatan ditolak jika membuat saldo negatif pada titik mana pun dalam riwayat album. Tanggal catatan tidak boleh di masa depan.
- Motivasi berasal dari gambar, alasan menabung, sisa nominal, dan progres pengguna sendiri. Jangan menambahkan angka atau riwayat fiktif sebagai data pengguna.
- Versi ini untuk satu pengguna. Pengembangan lokal tanpa login; container produksi memakai HTTP Basic Caddy untuk akses pemilik, tanpa sistem akun banyak pengguna.
- Foto unggahan berupa JPG, PNG, atau WebP valid, maksimal 4 MB, dan disimpan sebagai data gambar dalam database.
- Pengujian CRUD memakai instance MySQL sementara yang terpisah agar tidak mengubah database pengguna.
- Statistik menjadi halaman khusus laporan: setoran, penarikan, tabungan bersih, grafik enam bulan, perbandingan bulanan, dan rutinitas. Ringkasan berisi kondisi saat ini, album, dan maksimal lima catatan terbaru bulan ini dari seluruh album.
- Laporan bulanan menampilkan setoran, penarikan, dan tabungan bersih (setoran dikurangi penarikan), dengan pilihan semua album atau satu album. Gunakan istilah Penarikan karena catatan ini bukan pencatatan belanja harian.
- Grafik setoran menampilkan enam bulan kalender terakhir termasuk bulan berjalan. Batang grafik dapat dipilih untuk membuka rincian bulan tersebut.
- Bulan berjalan dibandingkan dengan periode tanggal yang sama pada bulan sebelumnya, dibatasi sampai hari terakhir jika bulan pembanding lebih pendek. Bulan selesai dibandingkan secara penuh.
- Jangan menghitung persentase kenaikan dari pembanding nol atau menyimpulkan tren ketika riwayat pembanding belum tersedia.
- Rutinitas dihitung dari bulan yang memiliki setoran dan rentetan bulan berurutan, terpisah dari besar nominal dan tabungan bersih. Bulan berjalan yang belum memiliki setoran tidak memutus rentetan bulan sebelumnya.
- Riwayat berfokus pada transaksi, dengan kelompok tanggal, jumlah catatan, total ringkas, serta tindakan ubah dan hapus. Default membuka bulan ini; riwayat lama tidak dibatasi enam bulan dan tetap dapat dipilih beserta tahun.
- Pengelompokan bulan memakai tanggal transaksi, bukan waktu catatan dimasukkan. Perubahan dan penghapusan catatan langsung menghitung ulang laporan.
- Label "Bulan ini" mengikuti bulan berjalan dalam zona waktu Asia/Jakarta. Pilihan bulan tertentu tetap dipertahankan saat kalender berganti; pilihan "Bulan ini" mengikuti bulan baru. Periksa perubahan kalender setiap menit serta saat halaman kembali aktif.
- Filter Statistik dan Riwayat terpisah dan dipertahankan selama aplikasi dibuka. Mengubah satu halaman tidak mengubah pilihan halaman lain. Detail album memiliki pilihan periode sendiri.
- Tombol "Lihat catatan periode ini" di Statistik membuka Riwayat dengan salinan pilihan periode dan album saat itu. Perubahan filter sesudahnya tetap terpisah. Tautan riwayat dari Ringkasan secara sengaja membuka bulan ini dan seluruh album.

## 4. Desain

- Mobile first menjadi standar: rancang susunan konten, navigasi, dan interaksi untuk ponsel terlebih dahulu, lalu sesuaikan untuk tablet dan desktop.
- Pada Tailwind, gunakan class dasar untuk tampilan ponsel dan breakpoint untuk penyesuaian layar yang lebih lebar.
- Desain harus modern dan interaktif, dengan keseimbangan antara isi, ruang kosong, warna, dan efek visual.
- Gunakan latar utama putih kehijauan `#f6f8f6` dengan kartu putih. Bayangan kartu dan navigasi dibuat lebih tegas tetapi konsisten; menu aktif mudah dikenali melalui warna, ikon, dan label.
- Tampilan harus terasa wajar untuk aplikasi pencatatan: jelas, nyaman dibaca, dan mudah digunakan.
- Tentukan warna, tipografi, dan jarak berdasarkan isi serta fungsi halaman.
- Berikan respons interaksi yang jelas pada tombol, form, dan perubahan data, termasuk keadaan aktif, memuat, berhasil, atau gagal bila relevan.
- Gunakan transisi dan animasi secukupnya untuk membantu pengguna mengikuti perubahan. Hormati preferensi pengurangan gerakan dan jangan menghambat tindakan pengguna.
- Pastikan tombol nyaman disentuh, fokus keyboard terlihat, dan tindakan penting tidak bergantung pada hover.
- Hindari gradient, efek glow, glassmorphism, kartu berulang, ikon dekoratif, dan animasi jika tidak punya fungsi yang jelas.
- Jangan mengisi halaman dengan slogan generik, klaim tanpa dasar, atau teks promosi sekadar untuk memenuhi layout.
- Gunakan bahasa antarmuka yang singkat dan konsisten.
- Tampilkan progres dari nilai saldo sebenarnya tanpa membulatkan setoran kecil menjadi nol. Penanda visual minimum boleh digunakan untuk saldo positif; persentase dan nominal harus tetap akurat.
- Periksa tampilan di ponsel, tablet, dan desktop, termasuk keterbacaan, ukuran tombol, navigasi, dan konten yang meluap secara horizontal.
- Kredit **I GEDE ADITYA SUASTIKA PUTRA** ditampilkan kecil di bawah sidebar desktop dan setelah konten pada ponsel. Hindari footer promosi besar dalam aplikasi. Kredit tetap tersedia saat database gagal dan tidak tertutup navigasi bawah.
- Navigasi ponsel memakai empat tombol dengan area sentuh minimal 44 piksel dan indikator aktif yang jelas. Desktop memakai sidebar dengan status serta kredit developer di bawah. Stylesheet sumber `assets/css/interface.css` mengatur penyempurnaan ini tanpa menyunting hasil build Tailwind.
- AOS atau Swiper boleh digunakan bila membantu kebutuhan halaman. Keduanya tidak wajib dipasang.

## 5. Penulisan kode

- Gunakan indentasi dan pola penamaan yang konsisten dengan file terkait.
- Kelompokkan kode menurut tanggung jawabnya. Pisahkan file saat pemisahan tersebut membantu pembacaan atau pemakaian ulang.
- Hindari baris kosong berlebihan, komentar pembatas yang panjang, dan struktur berlapis untuk pekerjaan sederhana.
- Tulis komentar untuk menjelaskan alasan atau aturan yang tidak langsung terlihat dari kode.
- Jangan membuat abstraksi, helper, atau komponen yang belum diperlukan.
- Jangan menyunting hasil build CSS secara manual; ubah sumber lalu build ulang.
- Validasi input di server. Jika menggunakan database, gunakan query berparameter dan tangani keluaran HTML dengan escaping yang sesuai.
- Jangan menyimpan kredensial di HTML, JavaScript browser, atau repository.

## 6. Alur kerja

1. Tetapkan kebutuhan bagian yang akan dikerjakan, termasuk data yang diperlukan dan hasil yang diharapkan.
2. Baca kode serta aturan proyek yang berkaitan sebelum mengubahnya.
3. Implementasikan perubahan dalam lingkup yang disepakati.
4. Periksa fungsi, tampilan, dan kondisi gagal yang berkaitan dengan perubahan.
5. Sampaikan hasil, file utama yang berubah, pemeriksaan yang dilakukan, dan kendala yang masih ada.
6. Perbarui SOP jika ada keputusan baru yang mengubah aturan proyek.

## 6a. Commit dan push GitHub

- Repository tujuan: `https://github.com/Adityagede/sadaku.git`, remote `origin`, branch utama `main`.
- Sebelum commit, periksa `git status` dan perubahan yang akan masuk. Pastikan `.env`, kredensial, kunci privat, data pribadi, log, dan backup database diabaikan melalui `.gitignore`.
- Simpan contoh konfigurasi tanpa rahasia di `.env.example`. `database/schema.sql` tetap masuk repository sebagai struktur tabel, tanpa data pengguna.
- Jalankan pemeriksaan yang sesuai, buat commit dengan pesan yang menjelaskan perubahan, lalu push ke GitHub. Hindari force push tanpa instruksi khusus.
- `.gitignore` tidak menghapus rahasia yang sudah terlanjur masuk riwayat Git. Jika terjadi kebocoran, cabut atau ganti kredensial terkait dan tangani riwayatnya sebelum publikasi berikutnya.

## 6b. Deployment produksi

- Ikuti `DEPLOYMENT.md`. Aplikasi dibungkus dengan Docker/FrankenPHP dan Caddy untuk Container Runtime Vercel. MySQL harus tersedia sebagai layanan online terpisah.
- Rahasia hanya disimpan dalam environment server. `.dockerignore` memakai daftar file yang diizinkan; `.env`, kredensial, backup, dan data lokal tidak masuk image.
- Direktori publik image hanya berisi halaman, aset browser, dan pembungkus API. Jangan menyajikan root repository sebagai direktori publik.
- Container memerlukan `APP_ENV=production`, kredensial database, `APP_USER`, `APP_PASSWORD_HASH` bcrypt, serta `APP_KEY` acak yang stabil antar-instance.
- Token CSRF produksi berupa cookie bertanda tangan berumur 24 jam dengan atribut Secure, HttpOnly, SameSite=Strict dan prefix `__Host-`. Sesi PHP lokal hanya dipakai untuk pengembangan.
- Koneksi MySQL produksi memakai TLS dengan verifikasi sertifikat; sesuaikan CA melalui `DB_SSL_CA_PEM` bila diperlukan.
- Database preview terpisah dari produksi. Build image, autentikasi, TLS, persistensi, dan operasi aplikasi harus diuji online sebelum deployment dinyatakan siap dipakai.

## 7. Syarat pekerjaan selesai

- Perilaku sesuai kebutuhan yang dibahas dan tidak ada fitur tambahan yang belum disepakati.
- Tidak ada tombol atau tautan yang terlihat berfungsi tetapi belum memiliki tindakan yang sesuai.
- Tidak ada error JavaScript atau PHP dari alur yang telah diperiksa.
- Perubahan tampilan telah diperiksa mulai dari layar ponsel, lalu tablet dan desktop, termasuk interaksi sentuh serta keadaan tombol dan form yang relevan.
- Jika ada input atau penyimpanan data, periksa input kosong, input tidak valid, keberhasilan simpan, dan kegagalan yang relevan.
- Pemeriksaan yang belum dapat dijalankan harus disebutkan; jangan menyatakan hasil yang belum diverifikasi.

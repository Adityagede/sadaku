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
- Detail album hanya memiliki satu CTA utama Catat uang. Susunan isi: saldo/target/progres, rencana jika ada, lalu aktivitas album. Rencana dan riwayat tidak menambah CTA pencatatan; perubahan album/rencana melalui Ubah album. Aktivitas album tidak mengulang filter bulan atau kartu laporan Statistik.
- Pencatatan dari dalam album atau kartu album mengunci tujuan sesuai konteks. Nama album ditampilkan sebagai informasi, tanpa pilihan Album tujuan. Pencatatan global dengan beberapa album tetap menyediakan pilihan; satu album otomatis dipilih. Mengedit dari Riwayat mengunci album catatan asli. Konteks album yang sudah hilang harus ditolak, bukan dialihkan diam-diam.
- Form catatan tidak memiliki input tanggal. Server menetapkan tanggal baru dan created_at dari satu waktu Asia/Jakarta saat penyimpanan, termasuk saat formulir melewati tengah malam. Abaikan tanggal kiriman browser pada catatan baru. Edit tidak mengubah tanggal/album asli, sehingga revisi nominal/jenis/keterangan tidak memindahkan riwayat lama ke hari ini.
- Catatan dapat dilihat, dibuat, diubah, dan dihapus. Saldo serta progres dihitung dari catatan tersimpan, bukan diisi manual.
- Perubahan catatan ditolak jika membuat saldo negatif pada titik mana pun dalam riwayat album. Tanggal catatan tidak boleh di masa depan.
- Motivasi berasal dari gambar, alasan menabung, sisa nominal, dan progres pengguna sendiri. Jangan menambahkan angka atau riwayat fiktif sebagai data pengguna.
- Versi ini untuk satu pengguna. Pengembangan lokal tanpa login; container produksi memakai HTTP Basic Caddy untuk akses pemilik, tanpa sistem akun banyak pengguna.
- Foto unggahan berupa JPG, PNG, atau WebP valid, maksimal 4 MB, dan disimpan sebagai data gambar dalam database.
- Pengujian CRUD memakai instance MySQL sementara yang terpisah agar tidak mengubah database pengguna.
- Statistik menjadi halaman khusus laporan: setoran, penarikan, tabungan bersih, rekam jejak maksimal enam bulan selesai, perbandingan bulanan, dan konsistensi. Riwayat selalu dimulai pada tanggal transaksi paling awal yang masih tersimpan, sesuai album yang dipilih. Tanpa catatan, tampil keadaan kosong tanpa angka ringkasan atau grafik/periode contoh. Ringkasan berisi kondisi saat ini, album, dan maksimal lima catatan terbaru bulan ini dari seluruh album.
- Laporan bulanan menampilkan setoran, penarikan, dan tabungan bersih (setoran dikurangi penarikan), dengan pilihan semua album atau satu album. Gunakan istilah Penarikan karena catatan ini bukan pencatatan belanja harian.
- Bulan berjalan memiliki ringkasan sendiri dan belum menjadi rekam jejak bulan selesai. Mulai November berarti nol bulan selesai selama November, satu bulan (November) saat Desember, dan dua bulan (November–Desember) saat Januari. Hitung selisih indeks bulan kalender, bukan hari dibagi 30.
- Grafik hanya menampilkan satu sampai maksimal enam bulan selesai terbaru sejak awal pencatatan. Bulan sebelum catatan pertama dan bulan berjalan tidak menjadi batang grafik. Bulan kosong di antara awal pencatatan dan bulan lalu tetap ditampilkan nol. Judul dan jumlah kolom mengikuti jumlah bulan nyata. Batang grafik dapat dipilih untuk membuka rincian bulan tersebut.
- Pilihan periode dimulai dari bulan transaksi pertama pada cakupan album sampai bulan berjalan. Sebelum ada bulan selesai, pilihan periode statistik disembunyikan. Ganti album, edit, dan hapus catatan menghitung ulang awal riwayat; pilihan di luar rentang baru kembali ke bulan berjalan. Menghapus semua catatan mengembalikan keadaan kosong.
- Bulan berjalan dibandingkan dengan periode tanggal yang sama pada bulan sebelumnya, dibatasi sampai hari terakhir jika bulan pembanding lebih pendek. Bulan selesai dibandingkan secara penuh.
- Jangan menghitung persentase kenaikan dari pembanding nol atau menyimpulkan tren ketika riwayat pembanding belum tersedia.
- Konsistensi dihitung dari bulan selesai yang memiliki setoran, terpisah dari besar nominal dan tabungan bersih. Rentetan menghitung bulan selesai berturut-turut sampai bulan lalu; bulan berjalan belum menambah atau memutusnya. Panel ini belum muncul sebelum ada bulan selesai. Awal tiap album dihitung sendiri, tanpa mengambil usia riwayat album lain.
- Halaman Riwayat menampilkan judul Aktivitas dan memuat seluruh album serta tanggal secara bawaan, terbaru di atas. Kelompok memakai bulan transaksi, dengan label Bulan ini pada bulan berjalan. Setiap kelompok memiliki tautan Laporan yang membuka Statistik untuk bulan dan cakupan album tersebut.
- Pencarian aktivitas mencakup keterangan, album, dan jenis. Filter Riwayat mencakup bulan, album, dan jenis. Unduhan CSV mencakup semua hasil saat ini, termasuk baris yang belum dimuat di layar. Riwayat tersedia tanpa ringkasan nominal atau CTA Catat uang.
- Baris Riwayat menampilkan ikon arah, keterangan, tanggal WIB, album, jenis, dan nominal. Ketuk untuk membuka rincian dan tindakan ubah/hapus. Dukung keyboard dan jangan membuat jam transaksi atau status pembayaran fiktif. Muat 30 aktivitas per langkah tanpa menggandakan catatan.
- Pengelompokan bulan memakai tanggal transaksi, bukan waktu catatan dimasukkan. Perubahan dan penghapusan catatan langsung menghitung ulang laporan.
- Label "Bulan ini" mengikuti bulan berjalan dalam zona waktu Asia/Jakarta. Pilihan bulan tertentu tetap dipertahankan saat kalender berganti; pilihan "Bulan ini" mengikuti bulan baru. Periksa perubahan kalender setiap menit serta saat halaman kembali aktif.
- Filter Riwayat dan Statistik bekerja pada tampilan masing-masing. Tautan Laporan di Riwayat memilih bulan dan album di Statistik. Aktivitas detail album tetap terbatas pada album tersebut dan dikelompokkan ke Hari ini, Kemarin, lalu tanggal lengkap dalam WIB. Aktivitas lama dimuat bertahap, dan pembukaan album lain mengembalikan daftar album ke 30 catatan terbaru.
- Tombol Buka Riwayat di Statistik dan Lihat riwayat dari Ringkasan membuka aktivitas terbaru semua album, tanpa menyalin filter Statistik atau membatasi bulan ini.
- Di Riwayat dan Statistik, tombol mengambang Buat album membuka formulir album yang sama. Menyimpan album membuka detail album baru. Membatalkan mengembalikan fokus ke tombol dan mempertahankan halaman serta filter.

## 3b. Rencana menabung dan pengingat album

- Rencana menabung diatur saat membuat album, setelah isian opsional. Pilihan Harian, Mingguan, dan Bulanan berupa tiga tombol radio dengan border rounded, bukan dropdown. Pengingat serta jam WIB berada di bawah pilihan jadwal, diikuti nominal, tanggal mulai, dan hari/tanggal pilihan. Bagian ini boleh dilewati atau dikosongkan dengan Tanpa rencana.
- Simpan album menyimpan album dan rencana dalam satu transaksi. Rencana tidak valid tidak boleh meninggalkan album setengah jadi. Ubah album memuat pengaturan rencana lama; memilih Tanpa rencana lalu menyimpan menghentikan rencana tersebut. Detail hanya menampilkan ringkasan rencana yang tersedia, tanpa alur pembuatan rencana terpisah.
- Semua input nominal (target, rencana, dan catatan) menggunakan titik ribuan otomatis saat diketik dan tetap menjaga posisi kursor. FormData mengirim angka tanpa titik. Validasi rupiah bulat, batas nominal, input kosong, tempel teks, dan penghapusan di sekitar pemisah tetap diperiksa.
- Pembukaan dialog, kemunculan pengaturan, pilihan jadwal, dan sakelar memakai transisi singkat. Hormati prefers-reduced-motion, sediakan fokus keyboard, serta nonaktifkan validasi isian rencana/pengingat saat bagiannya tidak digunakan.
- Tanggal 29–31 memakai hari terakhir bulan yang lebih pendek, lalu kembali ke tanggal pilihan pada bulan berikutnya. Jadwal pertama tidak mendahului tanggal mulai.
- Saran nominal memakai sisa target dan jumlah jadwal sampai tanggal target. Pengguna memilih menerapkan saran; nominal manual tidak ditimpa otomatis.
- Rencana tidak membuat transaksi. CTA tunggal Catat uang pada album dengan rencana aktif mengisi saran nominal sisa periode yang dibatasi sisa target; pengguna tetap menyimpan catatan. Mengganti jenis ke Penarikan membersihkan nominal yang diisi otomatis agar tidak dianggap nominal penarikan pilihan pengguna.
- Periode dimulai pada jadwal sampai sebelum jadwal berikutnya. Hanya setoran album yang sama di periode tersebut yang memenuhi nominal rencana. Penarikan tidak menghapus pencapaian setoran periode. Jadwal terlewat tidak menjadi utang atau tumpukan pengingat.
- Pengingat mengikuti jadwal dan jam Asia/Jakarta, berhenti selama jeda, nominal setoran periode terpenuhi, atau saldo mencapai target. Kondisi mengikuti data terbaru setelah catatan diubah/dihapus.
- Header utama memakai tombol titik tiga berlabel aksesibel Buka pengaturan. Riwayat memakai header Aktivitas dengan tombol kembali ke Ringkasan dan unduh CSV. Tombol pengaturan membuka halaman dengan rute #pengaturan. Kembali mengarah ke halaman/album sebelumnya, menjaga filter Statistik dan aktivitas yang telah dimuat; tautan langsung kembali ke Ringkasan. Empat menu utama tetap tersedia.
- Pengaturan memuat Tampilan, Keamanan, Izin perangkat, serta Tentang Sadaku. Tema Terang, Gelap, dan Ikuti perangkat berupa pilihan radio yang aksesibel. Pilihan berlaku di seluruh aplikasi, disimpan lokal per perangkat, diterapkan sebelum stylesheet dimuat, dan disinkronkan antar-tab. Mode Ikuti perangkat mengikuti perubahan tema sistem. Penyimpanan browser yang diblokir tidak boleh membuat aplikasi gagal.
- Aktivasi, status, notifikasi uji, dan penonaktifan notifikasi perangkat berada di halaman Pengaturan. Izin diblokir menjelaskan cara mengubahnya melalui pengaturan situs browser; tidak ada sakelar yang mengklaim mengubah izin sistem. Informasi WIB tetap tersedia.
- Autentikasi biometrik dan izin alarm tampil dengan status Belum tersedia pada versi web saat ini. Jangan menyimpan toggle biometrik lokal atau mengklaim album terlindungi sebelum autentikasi aman diintegrasikan. Izin alarm Android memerlukan integrasi perangkat, terpisah dari Web Push yang sudah ada.
- Rate the app dan Gift for developer menggunakan tautan HTTPS dari APP_RATE_URL serta APP_SUPPORT_URL. Jika kosong/tidak valid, tampilkan Belum tersedia tanpa tindakan palsu. Tautan yang tersedia terbuka di tab baru tanpa akses ke jendela asal. Jangan mengarang alamat Google Play atau tujuan dukungan developer.
- Pengguna mengaktifkan notifikasi sendiri melalui tombol sebelum izin browser diminta. Rencana tetap dapat disimpan saat izin ditolak atau layanan belum tersedia. Jangan menyatakan notifikasi perangkat aktif sebelum langganan berhasil disimpan ke server.
- Web Push memakai library Composer, service worker, kunci VAPID privat di environment, langganan perangkat di MySQL, serta penjadwal CLI setiap menit. Penjadwal bukan timer di halaman. Satu pengguna dapat mengaktifkan beberapa perangkat; penonaktifan hanya berlaku untuk perangkat tersebut.
- Tabel rencana, langganan, dan riwayat pengiriman ditambahkan dengan setup database yang idempoten. Pengujian integrasi memakai MySQL sementara dan transport simulasi tanpa mengirim notifikasi ke perangkat pengguna.
- `npm run dev` memakai peluncur PHP yang menyiapkan OpenSSL pada Windows dan menjalankan penjadwal jika VAPID sudah tersedia. Hosting function memerlukan penjadwal eksternal yang tetap tersedia; konfigurasi dan pengiriman nyata harus diverifikasi sebelum dinyatakan aktif di produksi.

## 4. Desain

- Mobile first menjadi standar: rancang susunan konten, navigasi, dan interaksi untuk ponsel terlebih dahulu, lalu sesuaikan untuk tablet dan desktop.
- Pada Tailwind, gunakan class dasar untuk tampilan ponsel dan breakpoint untuk penyesuaian layar yang lebih lebar.
- Desain harus modern dan interaktif, dengan keseimbangan antara isi, ruang kosong, warna, dan efek visual.
- Tema terang menggunakan latar utama putih `#fff`. Tema gelap menggunakan latar hijau gelap, permukaan terpisah, teks kontras, dan status setoran/penarikan yang tetap berbeda. Tema berlaku pada halaman, formulir, dialog, navigasi, riwayat, dan statistik. Menu aktif mudah dikenali melalui warna, ikon, dan label.
- Tampilan harus terasa wajar untuk aplikasi pencatatan: jelas, nyaman dibaca, dan mudah digunakan.
- Riwayat memakai header hijau penuh, kolom pencarian, dan daftar datar dengan pemisah tipis. Ikon arah di kiri, keterangan dan tanggal di tengah, serta nominal rata kanan. Rincian mendukung buka/tutup dengan ketukan/keyboard, transisi yang dapat dibalik saat diketuk cepat, dan perilaku native tanpa animasi saat prefers-reduced-motion aktif.
- Di Statistik, header dan grafik setoran bulan selesai memakai bidang hijau penuh. Pilihan periode dan panah bulan berada di dekat rentang tanggal laporan, diikuti cakupan album, dua tombol Setoran/Penarikan, rincian nominal per album sesuai jenis yang dipilih, tabungan bersih, perbandingan, dan konsistensi. Panah kembali mempertahankan filter Riwayat sebelumnya. Tombol Buka Riwayat di bawah laporan membuka aktivitas terbaru semua album.
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
- Navigasi ponsel menempel di tepi bawah, memakai empat tombol dengan area sentuh minimal 44 piksel. Menu aktif dilapis latar hijau lembut dan ikon berlatar hijau tua. Peralihan mengikuti preferensi pengurangan gerakan. Tombol mengambang berada di atas bar dan konten akhir bisa digulir hingga melewati tombol. Desktop memakai sidebar dengan status serta kredit developer di bawah.
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

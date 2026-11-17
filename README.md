# Sadaku

Aplikasi untuk mencatat uang dan menabung menuju album target. Mode awal langsung memakai penyimpanan browser tanpa akun. Stack: HTML, Tailwind CSS, JavaScript, IndexedDB, serta PHP/MySQL untuk server pribadi versi sebelumnya.

Dikembangkan oleh **I GEDE ADITYA SUASTIKA PUTRA**.

## Untuk developer

Baca [panduan struktur proyek](docs/PROJECT_STRUCTURE.md) untuk lokasi kode per halaman, komponen bersama, aturan domain, dan penyimpanan. `assets/js/app.js` menghubungkan modul; pengujian berada di `tests/`, sementara alat pengembangan berada di `scripts/`. Pemeriksaan utama: `npm run check`, `npm run test:unit`, lalu `npm run build`.

## Mata uang tabungan

Mode **Di perangkat ini** mendukung mata uang berbeda untuk setiap album: IDR, USD, EUR, SGD, GBP, AUD, CAD, MYR, JPY, dan CHF. Pilih melalui dropdown di sebelah kiri input **Nominal target** saat membuat album. Mata uang dan album tersimpan sekaligus melalui **Simpan album**; membatalkan formulir tidak mengubah data. Setelah tersimpan, mata uang album tetap; buat album baru untuk mata uang lain. Tidak ada konversi kurs.

USD/EUR dan mata uang dua desimal menerima input seperti `1250.50`; pecahan disimpan sebagai bilangan bulat dalam sen. IDR tetap memakai rupiah bulat sesuai perilaku sebelumnya, dan JPY memakai yen bulat. IDR menggunakan titik ribuan; mata uang lainnya menerima titik desimal dan koma ribuan. Format yang tidak sesuai ditolak. Mengganti mata uang pada draft album mengosongkan target dan nominal rencana agar nominal sebelumnya tidak berubah arti. Setoran, penarikan, dan rencana mengikuti mata uang album. Mengganti tujuan pencatatan ke mata uang lain mengosongkan nominal. Ringkasan memisahkan total per mata uang; Statistik memfilter mata uang sebelum menghitung laporan dan grafik. CSV campuran memiliki kolom mata uang per baris. Bahasa antarmuka tetap Indonesia dan zona waktu pencatatan/pengingat tetap WIB.

Wallet versi 3 menyimpan kode mata uang pada setiap album. Wallet versi 1 dibaca sebagai IDR; versi 2 menurunkan mata uang wallet ke semua album tanpa mengubah nominal. Cadangan versi 3 menyertakan kode mata uang dan skala nominal setiap album; cadangan versi 1 dan 2 tetap dapat dipulihkan. Pratinjau pemulihan menampilkan mata uang yang akan menggantikan data perangkat. Versi aplikasi lama tidak dapat membaca wallet/cadangan versi 3.

Server pribadi PHP/MySQL versi lama tetap menggunakan IDR; pilihan mata uang baru berlaku pada mode perangkat. Tidak ada migrasi database server atau perubahan nilai data pengguna. Jalankan `npm run test:currency` untuk pemeriksaan mata uang dan `npm run test:local` untuk alur penyimpanan/UI/offline. Pengujian UI otomatis memakai jsdom; pemeriksaan visual pada browser nyata masih diperlukan sebelum rilis.

## Mulai langsung tanpa akun

Jalankan `npm run dev`, lalu buka `http://127.0.0.1:8080`. Untuk mode **Di perangkat ini**, MySQL, Composer, dan konfigurasi `.env` database tidak diperlukan. Album, catatan, rencana, dan foto disimpan dalam IndexedDB pada browser dan origin tersebut. Port, domain, atau browser yang berbeda mempunyai penyimpanan terpisah. Membuka HTML melalui `file://` tidak didukung; gunakan server lokal atau hosting HTTPS.

Melalui **titik tiga → Cadangan dan pemulihan**, gunakan **Unduh cadangan** untuk membuat berkas JSON lengkap, termasuk foto dan tanggal historis. **Pulihkan cadangan** memvalidasi berkas maksimal 32 MB, menampilkan jumlah data, lalu meminta konfirmasi penggantian data lokal. Pemulihan berlangsung dalam satu transaksi dan ditolak jika data berubah sejak pratinjau. CSV di Riwayat tetap mengikuti filter dan bukan berkas pemulihan lengkap.

Data lokal dapat hilang ketika data situs dihapus, browser mengeviksinya, atau sesi privat berakhir. Cadangkan secara berkala; waktu yang ditampilkan adalah terakhir cadangan dibuat, bukan bukti berkas sudah disimpan pengguna. Browser yang tidak mengizinkan IndexedDB menampilkan kegagalan penyimpanan; aplikasi tidak berpindah diam-diam ke memori atau server. [Transaksi IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) menjadi dasar penyimpanan atomik.

Pada HTTPS atau loopback yang mendukung service worker, file aplikasi publik dicache setelah pendaftaran/instalasi berhasil sehingga dapat dibuka ulang secara offline. Cache tidak mencakup API, foto server, kredensial, atau isi cadangan. Build rilis baru perlu memperbarui versi cache di `sw.js`. Pengujian antarmuka offline pada browser nyata tetap diperlukan sebelum rilis.

**Buka data server pribadi** membuka MySQL versi lama secara terpisah. Data perangkat tidak otomatis disalin atau disinkronkan ke server. Untuk membawa data server ke perangkat: buka data server, unduh cadangan, kembali ke data perangkat, lalu pilih cadangan dan tinjau penggantiannya. Jangan menghapus data server sebagai bagian dari proses ini.

Akun cloud opsional dan sinkronisasi lintas perangkat **belum diimplementasikan**. Modul `data-source.js` memisahkan pemanggilan UI dari repository sehingga autentikasi/ownership dan sinkronisasi dapat ditambahkan kemudian. Jangan membuka API server pribadi kepada publik tanpa perlindungan akses.

## Deployment online

Konfigurasi Docker/FrankenPHP untuk Vercel tersedia di repository. Ikuti [panduan deployment](DEPLOYMENT.md) untuk database online, environment variables, akses pemilik, serta pemeriksaan produksi. Konfigurasi ini perlu di-build dan diuji di Vercel sebelum dinyatakan siap digunakan online.

## Menyiapkan server pribadi dan database (opsional)

Kebutuhan: PHP 8.2 atau lebih baru dengan ekstensi pdo_mysql, mbstring, fileinfo, curl, dan openssl; Composer; MySQL 8 atau lebih baru. BCMath atau GMP disarankan untuk Web Push. PHP menangani aplikasi, sedangkan MySQL menyimpan album, gambar, catatan uang, dan rencana menabung.

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
php -d upload_max_filesize=4M -d post_max_size=4352K -S 127.0.0.1:8080 scripts/serve.php
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

Pada layar di bawah 1024 px, tombol hijau **Buat album** mengambang di kanan bawah, dengan jarak 16 px di atas navigasi bawah. Tombol muncul di Ringkasan dan Album target setelah ada album; tombol Buat album di judul bagian digantikan agar tidak berulang. Saat belum ada album, gunakan tombol pada keadaan kosong. Tombol mengambang disembunyikan di detail album, Riwayat, Statistik, Pengaturan, saat dialog terbuka, dan saat pencarian album sedang digunakan. Pada desktop, tombol tetap berada di bagian judul. Tombol **Catat uang** tetap memiliki fungsi tersendiri.

1. Buat album dengan nama dan nominal target.
2. Pilih warna atau unggah foto sendiri (JPG, PNG, WebP; maksimal 4 MB). Tanggal target dan alasan menabung bersifat opsional.
3. Buka album, lalu tambahkan setoran atau penarikan.
4. Pantau saldo, sisa target, dan riwayat. Ubah atau hapus album dan catatan melalui tombol yang tersedia.

Detail album memiliki satu tombol utama **Catat uang**, diikuti ringkasan rencana dan daftar aktivitas album. Tidak ada tombol pencatatan tambahan pada rencana/riwayat, filter bulan, atau ringkasan bulanan berulang di dalam album. Laporan periode tersedia di Statistik. Rencana diubah melalui **Ubah album**.

Saat mencatat dari dalam album atau tombol pada kartu album, tujuan langsung mengikuti album tersebut dan tidak ditampilkan sebagai pilihan. Formulir hanya meminta jenis setoran/penarikan, nominal, dan keterangan opsional. Ringkasan nama album tetap terlihat. Pilihan album hanya muncul saat mencatat dari Ringkasan jika ada beberapa album; dengan satu album, tujuan langsung ditentukan.

Tanggal catatan baru otomatis ditetapkan ketika tombol simpan ditekan, memakai **Asia/Jakarta (WIB)**. Mode perangkat memakai jam perangkat; mode server memakai jam server dan tidak menerima tanggal dari browser. Tidak ada input tanggal; formulir yang terbuka melewati tengah malam mengikuti tanggal saat disimpan. Mengedit catatan lama mempertahankan tanggal dan album aslinya, termasuk data historis dari versi sebelumnya. Nominal/jenis/keterangan tetap dapat diedit dengan validasi saldo sepanjang riwayat.

Saldo dihitung dari catatan tersimpan. Perubahan yang membuat saldo negatif di bagian mana pun dalam riwayat ditolak. Mode perangkat memakai transaksi IndexedDB yang menserialkan penulisan wallet; server memakai transaksi dan penguncian album. Menghapus album ikut menghapus catatan di dalamnya setelah konfirmasi.

Aplikasi dimulai tanpa data contoh. Secara default data dan foto tersimpan dalam IndexedDB; pada mode server pribadi data berada di MySQL. Cadangan JSON tersedia melalui menu **Cadangan dan pemulihan**. Cadangan operasional MySQL tetap dilakukan melalui pengelola database.

## Rencana menabung dan pengingat

Saat **Buat album**, bagian **Rencana menabung (opsional)** muncul setelah isian alasan menabung. Pilih tombol rounded **Harian**, **Mingguan**, atau **Bulanan**, lalu atur pengingat di bawah pilihan jadwal, nominal per setoran, dan tanggal mulai. Mingguan memiliki hari pilihan dan bulanan memiliki tanggal pilihan. Rencana boleh dilewati dengan tidak memilih jadwal atau menekan **Tanpa rencana**. Album dan rencana disimpan sekaligus melalui **Simpan album**; jika rencana tidak valid, album tidak dibuat setengah jadi. Pengaturan yang sudah tersimpan dapat diubah melalui **Ubah album**. Detail album hanya menampilkan ringkasan jika rencana tersedia.

Tanggal 29–31 mengikuti hari terakhir pada bulan yang lebih pendek; bulan berikutnya kembali memakai tanggal pilihan awal. Jika ada tanggal target, tombol **Gunakan saran** mengisi nominal berdasarkan sisa saldo target dan jumlah jadwal yang tersedia. Perkiraan tanggal tercapai mengikuti nominal dan saldo saat ini.

Input nominal target, setoran rencana, dan catatan uang menggunakan pemisah ribuan otomatis saat diketik: `5000` menjadi `5.000`, `50000` menjadi `50.000`, dan `500000` menjadi `500.000`. Kursor mengikuti digit yang diedit. Nilai dikirim ke API sebagai angka tanpa titik; batas nominal dan validasi rupiah bulat tetap berlaku. Formulir menggunakan transisi singkat untuk pilihan aktif, pengingat, dan pembukaan dialog, serta menghormati preferensi pengurangan gerakan perangkat.

Aktifkan **Ingatkan saya**, lalu tentukan jam dalam **WIB (Asia/Jakarta)**. Rencana bersifat opsional. Menyimpan rencana tidak menambah saldo. Tombol utama **Catat uang** pada album dengan rencana aktif mengisi saran nominal sisa kebutuhan periode, dibatasi sisa target. Berpindah ke Penarikan membersihkan nominal yang diisi otomatis oleh rencana. Pengguna tetap menyimpan catatan untuk memperbarui saldo.

Setiap periode dimulai pada jadwal menabung sampai sebelum jadwal berikutnya. Setoran pada album yang sama dalam periode tersebut dijumlahkan; penarikan tidak menghapus fakta bahwa setoran periode sudah terpenuhi. Setoran sebelum periode dimulai tetap memengaruhi saldo album, tetapi tidak memenuhi jadwal mendatang. Tidak ada utang atau tumpukan pengingat dari jadwal yang terlewat. Rencana dapat dijeda. Pengingat berhenti selama saldo mencapai target, dan mengikuti kondisi saldo terbaru jika ada penarikan.

Tombol **titik tiga** di kanan header menampilkan menu **Pengaturan** (`#pengaturan`) dan **Cadangan dan pemulihan** (`#cadangan`). Pengaturan, cadangan, dan detail album memakai tombol Kembali untuk kembali ke layar sebelumnya. Buka baris **Tema aplikasi** untuk memilih **Terang**, **Gelap**, atau **Ikuti perangkat**. Pilihan disimpan di browser dan berlaku di seluruh aplikasi. Mode perangkat mengikuti perubahan tema sistem. Jika penyimpanan browser diblokir, perubahan tema berlaku selama halaman terbuka.

Baris **Notifikasi** menampilkan status perangkat. Buka baris tersebut untuk melihat detail, mengaktifkan notifikasi, mengirim uji, atau menonaktifkan perangkat ini. Izin browser diminta setelah pengguna menekan tombol aktivasi. Penolakan izin tidak menghalangi penyimpanan rencana. Tanggal dan jadwal menggunakan WIB.

**Autentikasi biometrik** dan **Izin alarm Android** belum diimplementasikan dan disembunyikan dari Pengaturan. Mode perangkat tetap mendukung penyimpanan rencana, tetapi belum menyediakan pengingat ketika aplikasi tertutup. Web Push mengikuti rencana pada server pribadi; aktifkan setelah membuka sumber data tersebut. Akun/passkey dan alarm native memerlukan tahap implementasi tersendiri; lihat [rancangan arsitektur](ARCHITECTURE.md).

**Beri penilaian** dan **Dukung pengembang** di menu titik tiga memakai konfigurasi publik `APP_RATE_URL` (halaman Google Play aplikasi) dan `APP_SUPPORT_URL` (alamat dukungan pengembang). Isi melalui `.env` lokal atau environment hosting. Tautan HTTPS yang valid terbuka di tab baru. Tautan kosong, tidak valid, atau berisi kredensial ditandai **Belum tersedia**.

Siapkan pengiriman pengingat lokal sekali:

```sh
composer install
php scripts/setup-database.php
npm run push:setup -- https://domain-sadaku-anda
npm run dev
```

Ganti alamat contoh dengan situs HTTPS milikmu atau `mailto:alamat-kontak`. Perintah setup menyimpan kunci VAPID ke `.env` yang diabaikan Git dan tidak mengganti kunci yang sudah ada. Jangan membuat ulang kunci saat restart karena langganan perangkat memakai kunci publik yang sama.

`npm run dev` menjalankan server PHP dan penjadwal pengingat bersama jika VAPID sudah tersedia. Pada Windows, peluncur menyiapkan `OPENSSL_CONF` dari instalasi PHP sebelum proses dimulai. Setelah memperbarui versi aplikasi ini, hentikan server lama lalu jalankan kembali `npm run dev`. Untuk Laragon/Apache atau server lain, jalankan `npm run reminders` terpisah dan pastikan `OPENSSL_CONF` sudah benar sebelum web server PHP dimulai. Pengingat tidak berjalan saat komputer/server dimatikan.

Gunakan HTTPS untuk situs online; loopback `http://127.0.0.1:8080` dapat dipakai untuk pengembangan lokal. Di iPhone/iPad, gunakan web app yang ditambahkan ke Layar Utama. Setelah server berjalan, buka **titik tiga → Pengaturan → Notifikasi → Aktifkan notifikasi**, lalu kirim notifikasi uji. Pengingat asli memakai Web Push sehingga tidak memerlukan halaman tetap terbuka. Waktu penerimaan bergantung pada jaringan, browser, dan pengaturan perangkat.

Penjadwal memeriksa jadwal setiap menit. Setiap jadwal dikirim paling banyak sekali per perangkat saat proses berjalan normal; pengiriman yang gagal dapat dicoba ulang, langganan kedaluwarsa dihapus, dan tag notifikasi yang sama mencegah penumpukan pada perangkat. Riwayat pengiriman tersimpan di MySQL. Pengiriman uji memakai layanan push sebenarnya; pengujian otomatis memakai transport simulasi agar tidak mengirim pesan ke perangkat pengguna.

Pada database lama, jalankan kembali `php scripts/setup-database.php` untuk menambahkan tabel `saving_plans`, `push_subscriptions`, dan `reminder_deliveries` secara aman. Perintah ini tidak menghapus album/catatan lama. Untuk hosting dan penjadwal produksi, lihat [panduan deployment](DEPLOYMENT.md#pengingat-web-push).

Pengujian tambahan: `npm run test:plans` dan `npm run test:money`. `npm test -- "C:/laragon/bin/mysql/mysql-8.4.3-winx64"` juga memeriksa pembuatan album bersama rencana, validasi, persistensi, serta pengiriman dan deduplikasi dengan MySQL sementara.

## Laporan dan riwayat bulanan

Navigasi terdiri dari **Ringkasan**, **Album target**, **Riwayat**, dan **Statistik**. Ringkasan menampilkan kondisi tabungan saat ini, album, dan maksimal lima catatan terbaru bulan berjalan dari seluruh album.

Pada **Statistik**, pilih semua album atau satu album untuk melihat total setoran, penarikan, serta tabungan bersih. Awal riwayat dihitung dari tanggal transaksi paling awal yang masih tersimpan dalam cakupan album tersebut. Sebelum ada catatan, tampil keadaan kosong tanpa angka ringkasan, grafik, atau periode contoh. Album yang belum memiliki catatan tetap kosong meskipun album lain sudah memiliki riwayat. Istilah Penarikan merujuk pada uang yang diambil dari tabungan, bukan otomatis pengeluaran belanja.

Bulan berjalan memiliki ringkasan sendiri dan belum masuk rekam jejak bulan selesai. Jika catatan pertama ada di November, selama November belum ada bulan riwayat; saat masuk Desember baru ada November sebagai satu bulan selesai. Januari memiliki dua bulan selesai (November dan Desember). Jumlah bulan selesai dihitung dari selisih indeks bulan kalender saat ini dengan bulan catatan pertama, bukan dari jumlah hari dibagi 30.

Grafik tumbuh dari satu sampai maksimal enam bulan selesai terbaru, tanpa memasukkan bulan sebelum awal pencatatan atau bulan berjalan. Bulan kosong setelah mulai mencatat tetap ditampilkan dengan nilai nol. Judul mengikuti jumlah bulan nyata; batang dapat dipilih untuk membuka ringkasannya. Riwayat lebih lama tetap tersedia melalui pilihan periode, yang hanya membentang dari bulan catatan pertama sampai bulan berjalan. Pilihan periode yang tidak lagi valid setelah pergantian album atau penghapusan catatan kembali ke bulan berjalan.

Perbandingan memakai nominal setoran. Untuk bulan berjalan, tanggal 1 sampai hari ini dibandingkan dengan rentang tanggal yang sama pada bulan sebelumnya. Jika bulan sebelumnya lebih pendek, rentangnya berhenti pada hari terakhir bulan tersebut. Untuk bulan selesai, perbandingan memakai total bulan penuh. Pembanding nol tidak ditampilkan sebagai persentase, dan riwayat yang belum cukup diberi keterangan.

Konsistensi menampilkan jumlah bulan dengan setoran dari maksimal enam bulan selesai terakhir sejak awal riwayat. Rentetan hanya menghitung bulan selesai yang memiliki setoran berturut-turut sampai bulan lalu; setoran bulan berjalan belum menambah atau memutus hitungan ini. Sebelum ada bulan selesai, panel konsistensi/rentetan belum ditampilkan. Nominal setoran yang turun atau adanya penarikan tidak menghapus fakta bahwa ada setoran pada bulan tersebut. Perbandingan tidak menyimpulkan naik/turun jika rentang pembanding belum memiliki riwayat pencatatan.

Halaman **Riwayat** membuka layar **Aktivitas**. Daftar dimulai dari transaksi terbaru semua album dan dikelompokkan berdasarkan bulan transaksi dalam WIB. **Laporan** pada setiap kelompok membuka Statistik untuk bulan tersebut dan mengikuti pilihan album di Riwayat.

Setiap aktivitas menampilkan jenis, keterangan, tanggal, album, dan nominal bertanda masuk/keluar. Ketuk aktivitas untuk membuka rincian, **Ubah catatan**, atau **Hapus**. **Lihat aktivitas sebelumnya** menambah 30 catatan tanpa menggandakan baris. Aktivitas di detail album tetap dikelompokkan menurut hari dan dibatasi album tersebut.

Cari keterangan, nama album, atau jenis aktivitas. **Filter aktivitas** menyediakan pilihan bulan, album, dan jenis. Tombol unduh mengekspor CSV dari semua hasil pencarian dan filter saat ini. Tautan **Buka Riwayat** dari Statistik serta **Lihat riwayat** dari Ringkasan membuka daftar terbaru dari semua album dengan pencarian dan filter dikosongkan.

Pilihan **Bulan ini** mengikuti pergantian kalender dalam zona waktu Asia/Jakarta. Contohnya, saat Desember dimulai, pilihan ini membuka Desember dan November tampil sebagai **November 2026**. Jika pengguna sengaja memilih November, pilihan itu tetap di November. Halaman mengecek pergantian tanggal setiap menit dan saat tab kembali aktif.

Aktivitas lama tetap dapat dimuat melampaui enam bulan, baik dari Riwayat maupun detail album. Pada Statistik, bulan lama tetap dapat dipilih termasuk bulan kosong di antaranya. Data historis bertanggal 30 November tetap dikelompokkan pada 30 November; catatan baru yang disimpan pada 1 Desember otomatis masuk 1 Desember. Mengedit atau menghapus catatan memperbarui aktivitas dan laporan; menghapus album juga menghapus catatan serta kontribusinya pada laporan, sesuai alur CRUD.

Pengujian aktivitas: `npm run test:activity`, `npm run test:entry`, dan `npm run test:navigation` memeriksa pengelompokan bulan, pencarian dan filter sebelum pemuatan bertahap, format CSV, transisi buka/tutup, penguncian album konteks, dan cakupan filter tiap tampilan. Pengujian API memeriksa tanggal otomatis server dan tanggal asli catatan lama; fixture historis hanya dapat disiapkan lewat CLI pada database pengujian sementara.

Tanggal awal dan seluruh statistik dihitung ulang setelah catatan diubah/dihapus; jika semua catatan dihapus, statistik kembali kosong. Transaksi mundur tetap menggunakan tanggal transaksi, bukan tanggal album dibuat atau waktu inputnya. Fitur bulanan dihitung dari catatan yang sudah tersimpan. Tidak diperlukan tabel atau migrasi database baru. `npm run test:monthly` memeriksa keadaan kosong, bulan pertama, pergantian November–Desember, bulan kosong, tahun baru, Februari, filter album, serta perubahan/penghapusan catatan pertama.

## Struktur

Panduan lengkap beserta pohon folder dan tabel lokasi perubahan tersedia di [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md). Entry browser adalah `assets/js/app.js`; `pages/` mengurus halaman/formulir, `components/` mengurus perilaku bersama, `domain/` mengurus aturan dan perhitungan, dan `data/` mengurus penyimpanan serta koneksi. Navbar/footer dan markup tetap ditulis sekali di `index.html`. Pengujian berada di `tests/`, alat operasional di `scripts/`.

## Pengembangan dan pengujian

Pengujian lokal memakai `fake-indexeddb` untuk transaksi dan `jsdom` untuk alur DOM tanpa database. Gunakan Node.js 24 LTS minimal 24.15 untuk dependensi pengujian ini; lingkungan verifikasi saat pengembangan memakai 24.20. Kedua paket hanya dependensi pengembangan dan tidak dimuat oleh browser aplikasi.

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
npm run test:settings
npm run test:csrf
npm run test:local
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

Mode perangkat dapat dipakai tanpa akun dan tidak mengirim data tabungan ke database server. Server pengembangan hanya terikat pada `127.0.0.1`, tanpa login lokal. Pada container produksi, shell aplikasi publik dapat dibuka langsung, sedangkan seluruh path `/php/*` dilindungi HTTP Basic melalui Caddy. Server pribadi tetap merupakan database satu pemilik; semua browser yang berhasil masuk ke API tersebut melihat data yang sama. Perlindungan Caddy ini belum diuji melalui container dalam lingkungan pengembangan sekarang; verifikasi sebelum deployment.

Untuk Apache, aktifkan `mod_rewrite` dan `AllowOverride All` agar aturan `.htaccess` berlaku. Pada hosting, isi konfigurasi database yang diberikan penyedia hosting melalui environment server atau `.env`. Penyiapan akses banyak pengguna merupakan pekerjaan terpisah.

Tanggal pencatatan menggunakan zona waktu Asia/Jakarta. Mata uang berupa rupiah bulat.

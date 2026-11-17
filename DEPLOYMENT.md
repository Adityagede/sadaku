# Deploy Sadaku ke Vercel

Sadaku menjalankan HTML, aset, dan API PHP dalam satu container FrankenPHP/Caddy. MySQL tetap berupa layanan database terpisah. Tidak diperlukan penggantian framework atau pemindahan backend ke JavaScript.

Panduan resmi: [PHP dengan Docker](https://vercel.com/kb/guide/deploy-php-on-vercel-with-docker), [Container Runtime](https://vercel.com/docs/functions/runtimes/container), dan [batas Functions](https://vercel.com/docs/functions/limitations). Container Runtime masih Beta; cek ketersediaan dan ketentuan akun saat deployment.

## Status persiapan

- Berkas Docker, konfigurasi web server, dan direktori publik yang terpisah sudah disiapkan.
- Hanya halaman, stylesheet, JavaScript, SVG bawaan, dan pembungkus API yang masuk direktori publik. `.env`, SQL, skrip pemeliharaan, serta kode internal tidak disajikan sebagai file statis.
- Shell aplikasi (HTML, aset, dan service worker) dapat dibuka langsung untuk mode perangkat tanpa akun. Caddy meminta HTTP Basic pada seluruh path `/php/*`, termasuk API dan gambar server. Browser menampilkan dialog username/password ketika pengguna membuka data server pribadi. Ini bukan sistem akun banyak pengguna. Untuk mengakhiri akses server, tutup seluruh sesi browser privat yang dipakai; belum ada tombol logout aplikasi. Matcher `basic_auth` mengikuti [sintaks resmi Caddy](https://caddyserver.com/docs/caddyfile/directives/basic_auth); autentikasi aktual harus diverifikasi pada container sebelum rilis.
- Token CSRF produksi memakai cookie bertanda tangan dengan `APP_KEY`, bukan sesi file container. Token berlaku 24 jam dan dapat divalidasi instance lain dengan kunci yang sama. Setelah token kedaluwarsa atau kunci diganti, muat ulang halaman.
- Pada mode perangkat, data dan foto disimpan di IndexedDB browser, dengan cadangan/pemulihan JSON di perangkat. Mode server pribadi tetap memakai MySQL. Tidak ada data pengguna yang bergantung pada filesystem container. Data dari dua mode tidak dicampur otomatis.
- Batas gambar menjadi 4 MiB (ditulis 4 MB di antarmuka). Batas keseluruhan formulir 4352 KiB memberi ruang metadata sambil berada di bawah batas payload Functions 4,5 MB.
- Build image, autentikasi Caddy, TLS database online, dan pengujian Vercel harus diverifikasi di lingkungan yang mempunyai Docker dan akses layanan tersebut. Berkas konfigurasi saja belum berarti situs sudah online.

## Pengingat Web Push

Image menyertakan library Web Push, `sw.js`, serta `scripts/send-reminders.php`. Jalankan ulang setup database atau impor tabel baru dari skema sebelum merilis perubahan ini. Tabel tambahan tidak mengubah atau menghapus album dan catatan lama.

Buat kunci sekali menggunakan `composer install`, lalu `npm run push:setup -- https://domain-sadaku-anda` pada lingkungan lokal. Simpan `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` dari `.env` langsung ke pengaturan environment hosting; jangan menyalinnya ke kode, chat, atau Git. Gunakan domain HTTPS aplikasi atau alamat kontak `mailto:` sebagai subject produksi. Kunci harus sama pada web server dan penjadwal, serta stabil setelah redeploy. Kunci privat tidak dikirim ke browser.

Untuk host container yang terus berjalan, isi `REMINDERS_WORKER=true` agar entrypoint menjalankan penjadwal setiap menit bersama server. Untuk layanan yang bisa tidur atau membatasi durasi proses (termasuk hosting function), gunakan scheduler/worker yang terus tersedia di luar proses web. Jangan mengandalkan proses latar belakang container function untuk jadwal tepat waktu.

Scheduler eksternal perlu menjalankan perintah berikut setiap menit dari source/image aplikasi yang sama, dengan environment database dan VAPID yang sama:

```sh
php /app/scripts/send-reminders.php
```

Contoh cron pada host Linux yang menyimpan aplikasi di `/app`: `* * * * * cd /app && php scripts/send-reminders.php`. Atur rahasia melalui pengelola service/scheduler. Skrip mengakses MySQL langsung; tidak ada endpoint publik untuk memicu pengiriman. Penguncian MySQL mencegah penjadwal yang tumpang tindih, dan tabel pengiriman mencegah pengiriman ulang normal untuk album, perangkat, dan tanggal yang sama.

Halaman menggunakan HTTPS dan setiap perangkat diaktifkan melalui **titik tiga → Pengaturan → Notifikasi → Aktifkan notifikasi**. Jalankan notifikasi uji sebelum menganggap pengiriman produksi siap. Verifikasi pengingat terjadwal dengan tab tertutup, rencana dijeda, setoran terpenuhi, dan target tercapai. Dukungan penerimaan bergantung pada browser, sistem operasi, koneksi, dan pengaturan perangkat.

## 1. Siapkan database online

Gunakan MySQL 8+ yang mendukung koneksi dari Vercel melalui TLS. Pilih lokasi database yang dekat dengan lokasi function untuk mengurangi waktu koneksi.

1. Buat database dan akun khusus Sadaku; jangan memakai akun administrator untuk akses aplikasi.
2. Impor `database/schema.sql` melalui pengelola database penyedia. Skema tidak berisi catatan pribadi.
3. Akun runtime membutuhkan SELECT, INSERT, UPDATE, dan DELETE pada tabel Sadaku. Impor awal memakai akun yang memiliki izin membuat tabel.
4. Jika data lokal akan dipindahkan, ekspor dan impor melalui alat database. Simpan backup di luar Git dan image Docker.
5. Siapkan backup otomatis dari penyedia database dan gunakan database terpisah untuk preview.

`127.0.0.1` dari Vercel mengarah ke instance aplikasi, bukan MySQL di laptop. Gunakan hostname database yang diberikan penyedia.

## 2. Siapkan environment produksi

Isi nilai di Vercel **Project Settings → Environment Variables**, untuk Production. Preview memakai database dan rahasia terpisah. Jangan menyalin `.env.example` mentah ke produksi.

| Nama | Nilai |
| --- | --- |
| `APP_ENV` | `production` (juga merupakan default image) |
| `DB_HOST` | Hostname database online |
| `DB_PORT` | Port dari penyedia, umumnya `3306` |
| `DB_DATABASE` | Nama database |
| `DB_USERNAME` | Akun khusus aplikasi |
| `DB_PASSWORD` | Password database yang tidak kosong |
| `DB_SSL` | `true` |
| `DB_SSL_CA_PEM` | Isi sertifikat CA penyedia jika tidak dipercaya CA sistem; opsional untuk CA publik |
| `APP_USER` | Username pemilik, hanya huruf, angka, `_`, dan `-` |
| `APP_PASSWORD_HASH` | Hash bcrypt password pemilik, bukan password mentah |
| `APP_KEY` | Kunci acak minimal 32 karakter; gunakan hasil perintah di bawah |
| `PORT` | `80` (default image) |
| `APP_RATE_URL` | Opsional: tautan HTTPS halaman Google Play Sadaku; kosong menampilkan Belum tersedia |
| `APP_SUPPORT_URL` | Opsional: tautan HTTPS dukungan developer; kosong menampilkan Belum tersedia |

Pada produksi, TLS database aktif secara default jika `DB_SSL` tidak diisi. Jika penyedia memberikan CA khusus, `DB_SSL_CA_PEM` menerima teks PEM dengan newline asli dari pengaturan Vercel atau karakter literal `\n`. Verifikasi sertifikat tetap aktif. Jangan menggantinya dengan `DB_SSL=false` untuk mengatasi kesalahan sertifikat.

Buat `APP_KEY` di terminal lokal:

```powershell
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

Simpan hasil sebagai environment variable. Kunci harus tetap sama antar-instance dan redeploy pada environment yang sama; jangan membuat kunci baru setiap request atau startup. Jangan kirim hasilnya ke chat atau repository.

## 3. Build dan periksa image

Pasang dan jalankan Docker Desktop. Dari root proyek:

```powershell
docker build -t sadaku .
```

Docker memakai CSS hasil build yang sudah disertakan. `assets/css/interface.css` adalah stylesheet sumber terpisah untuk permukaan, navigasi, Pengaturan, dan kredit developer; `assets/css/theme.css` mengatur tema aplikasi. `assets/js/theme.js` dimuat sebelum stylesheet agar tema pilihan tidak berkedip saat halaman dibuka. Jika styling Tailwind berubah, jalankan `npm install` dan `npm run build` sebelum commit.

Buat hash password pemilik dengan prompt interaktif Caddy; password tidak ditulis sebagai argumen command:

```powershell
docker run --rm -it --entrypoint frankenphp sadaku hash-password
```

Simpan hasil hash ke `APP_PASSWORD_HASH`. Masukkan password asli tersebut pada dialog login browser saat membuka situs.

Untuk uji lokal image, buat `.env.production.local` yang sudah diabaikan Git. Isi environment produksi termasuk rahasia, dengan sintaks `NAME=value` tanpa kutip pembungkus. Pada file Docker ini, gunakan `\n` untuk newline sertifikat CA. File ini berbeda dari `.env` yang dibaca PHP lokal.

```powershell
docker run --rm --env-file .env.production.local -p 127.0.0.1:8082:80 sadaku
```

Buka `http://localhost:8082` untuk pemeriksaan lokal. Pada Vercel, gunakan HTTPS. Jika menguji MySQL di host Docker Desktop, hostname-nya `host.docker.internal`, bukan `127.0.0.1`. Konfigurasi produksi sebaiknya diuji dengan database pengujian online melalui TLS.

## 4. Hubungkan repository ke Vercel

1. Pastikan seluruh perubahan sudah di-commit dan di-push ke `https://github.com/Adityagede/sadaku.git`.
2. Di Vercel, pilih **Add New → Project**, lalu impor repository `sadaku`.
3. Root Directory: root repository. Framework Preset: **Container**. Dockerfile: `Dockerfile` di root.
4. Gunakan proses build container; tidak perlu menjalankan `npm run dev` atau menetapkan root repository sebagai output statis.
5. Isi environment variables. Jangan isi database atau password produksi untuk preview.
6. Deploy dan periksa build log serta runtime log. Buka URL HTTPS `.vercel.app`, lalu masuk dengan kredensial pemilik.

Untuk alur ini Vercel dapat membangun Dockerfile dari GitHub; Docker Desktop diperlukan untuk pemeriksaan image lokal, bukan untuk menjaga situs tetap hidup. Laptop dan Laragon tidak harus menyala setelah aplikasi terhubung dengan MySQL online.

## 5. Pemeriksaan sebelum dipakai

- Tanpa kredensial, halaman dan `/php/api.php?action=state` harus mengembalikan 401. Kredensial salah tetap ditolak.
- Dengan kredensial benar, halaman, aset, API, dan gambar berfungsi melalui HTTPS.
- `.env`, `/php/database.php`, `/database/schema.sql`, `/Dockerfile`, dan `/deployment/entrypoint.sh` tidak dapat diunduh.
- Buat, ubah, dan hapus album/catatan pengujian. Periksa setoran kecil, penarikan, validasi saldo, serta statistik bulanan.
- Unggah foto di bawah 4 MB; file di atas batas ditolak dengan pesan yang jelas.
- Coba aplikasi di ponsel dan desktop, termasuk footer dan navigasi bawah.
- Redeploy, lalu pastikan data dan foto tetap ada. Pengujian juga harus mencakup penggunaan token CSRF antar-instance di Vercel.
- Konfirmasi backup database dan pemulihannya sebelum menyimpan data penting.

Situs siap digunakan setelah build container dan pemeriksaan tersebut lulus pada environment online. Domain khusus dapat ditambahkan setelah URL bawaan sudah bekerja.

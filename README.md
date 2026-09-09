# Sistem Informasi & Booking Kursus Mengemudi Mobil — Panca Sari Jaya (PSJ)

Sistem berbasis web untuk manajemen operasional, pendaftaran, dan penjadwalan latihan mengemudi mobil pada **PT Panca Sari Jaya (PSJ Driving Course)** Tangerang.

---

## 🚀 Fitur Utama

### 1. Sisi Pengguna / Siswa (Public)
* **Landing Page Interaktif**: Informasi profil lembaga, pilihan paket latihan (Manual, Matic, Kombinasi, +Pengurusan SIM, Private), keunggulan, armada mobil, dan FAQ.
* **Pendaftaran Online**: Formulir registrasi siswa baru dengan validasi ketat, pilihan metode latihan (Datang ke Outlet / Penjemputan ke Rumah), kalkulasi biaya otomatis, dan QRIS interaktif.
* **Atur & Cek Jadwal Online (`/jadwal.html`)**:
  * Pengecekan jadwal menggunakan nomor WhatsApp terdaftar.
  * Kalender booking interaktif dengan visual slot terisi / tersedia secara real-time.
  * Pemilihan sesi jam, tanggal latihan, dan instruktur mengemudi favorit.
  * Fitur Reschedule dan Pembatalan jadwal latihan.
* **Tambah Paket Baru Tanpa Daftar Ulang**: Siswa yang telah menyelesaikan paket dapat langsung memilih paket baru dan bayar via QRIS tanpa perlu mengulang pendaftaran identitas.
* **Notifikasi WhatsApp Otomatis (Fonnte API)**: Invoice pendaftaran, rincian biaya, dan pengingat jadwal latihan terkirim langsung ke nomor WhatsApp siswa dan admin.

### 2. Sisi Administrator (Admin Panel)
* **Dashboard Statistik**: Ringkasan total siswa, siswa aktif, siswa selesai, siswa belum bayar, jadwal hari ini, dan pendaftaran terbaru.
* **Manajemen Data Siswa**:
  * Pengelolaan status siswa (`pending`, `aktif`, `selesai`, `nonaktif`).
  * Pemantauan status pembayaran (`Lunas` / `Belum Lunas`) dengan fitur *one-click toggle*.
  * Pelacakan progres pertemuan/kehadiran (`total_hadir` vs `jumlah_pertemuan`) dengan riwayat akumulasi paket.
  * Detail profil lengkap, alamat penjemputan, riwayat paket, dan riwayat absensi.
* **Penjadwalan & Absensi**:
  * Monitoring seluruh jadwal booking siswa dan status kehadiran instruktur/armada.
  * Pencatatan kehadiran (*hadir*, *tidak hadir*, *izin*) serta catatan evaluasi latihan.
* **Pengingat WhatsApp**: Pengiriman pesan konfirmasi dan reminder jadwal latihan secara massal atau per siswa.
* **Keamanan & Proteksi**:
  * Proteksi route admin via session authentication dan CSRF/brute-force rate limiting.
  * Perlindungan SQL injection dan XSS sanitization di seluruh endpoint API.

---

## 🛠️ Tech Stack

* **Backend**: Node.js, Express.js
* **Database**: MySQL (via `mysql2/promise`)
* **Frontend**: HTML5, CSS3 Modern, Vanilla JavaScript (ES6+)
* **Keamanan & Middleware**: `helmet`, `cors`, `express-session`, `express-rate-limit`, `bcrypt`
* **Third-Party Integration**: Fonnte API (WhatsApp Gateway)

---

## 📂 Struktur Direktori

```
sistem-mobil/
├── admin/                  # Halaman & asset admin panel
│   ├── css/admin.css       # Style admin dashboard
│   ├── js/admin.js         # Logika admin panel & API call
│   ├── dashboard.html      # Tampilan utama admin dashboard
│   └── login.html          # Halaman login admin
├── config/
│   └── database.js         # Konfigurasi koneksi MySQL pool
├── database/
│   ├── schema.sql          # Schema DDL tabel database MySQL
│   └── seed.js             # Seeder akun admin awal & data default
├── public/                 # File aset statis publik
│   ├── css/                # Stylesheet landing page & jadwal
│   ├── images/             # Gambar armada, logo, favicon, QRIS
│   ├── js/landing.js       # Logika form pendaftaran & UI publik
│   ├── index.html          # Landing page utama
│   └── jadwal.html         # Halaman cek & booking jadwal siswa
├── routes/                 # Endpoint REST API Express.js
│   ├── absensi.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── instruktur.js
│   ├── jadwal.js
│   ├── paket.js
│   ├── siswa.js
│   └── whatsapp.js
├── .env.example            # Template konfigurasi environment variable
├── .gitignore
├── package.json
└── server.js               # File utama server Express & migrasi otomatis
```

---

## ⚙️ Panduan Instalasi Lokal

### 1. Prasyarat
* Node.js versi 18 atau lebih baru ([Unduh Node.js](https://nodejs.org/))
* MySQL Server (bisa via XAMPP, Laragon, atau MySQL Workbench)
* Git

### 2. Clone Repository
```bash
git clone https://github.com/USERNAME_ANDA/NAMA_REPO.git
cd NAMA_REPO
```

### 3. Install Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan konfigurasi database dan kredensial Anda di file `.env`:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=kursus_mengemudi
DB_PORT=3306

SESSION_SECRET=kunci_rahasia_acak_panjang_anda

FONNTE_TOKEN=token_fonnte_anda
ADMIN_PHONE=6281xxxxxxxxxx
```

### 5. Setup Database MySQL
1. Buat database baru di MySQL / phpMyAdmin:
   ```sql
   CREATE DATABASE kursus_mengemudi;
   ```
2. Import struktur tabel dari file `database/schema.sql` ke database tersebut.
3. Jalankan seed awal untuk membuat akun admin default (opsional):
   ```bash
   node database/seed.js
   ```
   *Default Akun Admin:*
   * Username: `admin`
   * Password: `admin123`

### 6. Jalankan Server
* **Mode Production / Standar:**
  ```bash
  npm start
  ```
  atau
  ```bash
  node server.js
  ```
* Buka browser dan akses:
  * Publik: `http://localhost:3000`
  * Cek Jadwal: `http://localhost:3000/jadwal.html`
  * Admin Panel: `http://localhost:3000/admin`

---

## 📄 Lisensi

Proyek ini dikembangkan untuk keperluan Kerja Praktek & Pengembangan Sistem Manajemen Kursus Mengemudi Mobil PT Panca Sari Jaya.

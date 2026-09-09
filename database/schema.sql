-- ============================================
-- Database Schema: Kursus Mengemudi Mobil
-- Panca Sari Jaya Driving School
-- ============================================


-- ============================================
-- Tabel Admin
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabel Paket Kursus
-- ============================================
CREATE TABLE IF NOT EXISTS paket_kursus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_paket VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    jumlah_pertemuan INT NOT NULL DEFAULT 5,
    harga DECIMAL(12,2) NOT NULL,
    durasi_per_sesi INT NOT NULL DEFAULT 90 COMMENT 'dalam menit',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabel Siswa (Pendaftar)
-- ============================================
CREATE TABLE IF NOT EXISTS siswa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_lengkap VARCHAR(100) NOT NULL,
    no_telepon VARCHAR(20) NOT NULL,
    alamat TEXT,
    paket_id INT,
    status ENUM('pending', 'aktif', 'nonaktif', 'selesai') DEFAULT 'pending',
    status_pembayaran ENUM('lunas', 'belum_lunas') DEFAULT 'belum_lunas',
    pertemuan_sebelumnya INT DEFAULT 0,
    riwayat_paket TEXT,
    tanggal_daftar TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    catatan TEXT,
    FOREIGN KEY (paket_id) REFERENCES paket_kursus(id) ON DELETE SET NULL
);

-- ============================================
-- Tabel Instruktur (dipertahankan untuk FK jadwal)
-- ============================================
CREATE TABLE IF NOT EXISTS instruktur (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    no_telepon VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabel Armada / Kendaraan (dipertahankan untuk FK jadwal)
-- ============================================
CREATE TABLE IF NOT EXISTS armada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_kendaraan VARCHAR(100) NOT NULL,
    nomor_polisi VARCHAR(20) NOT NULL UNIQUE,
    jenis VARCHAR(50) NOT NULL COMMENT 'manual/matic',
    tahun INT,
    warna VARCHAR(30),
    status ENUM('tersedia', 'digunakan', 'maintenance', 'tidak aktif') DEFAULT 'tersedia',
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabel Jadwal Latihan
-- ============================================
CREATE TABLE IF NOT EXISTS jadwal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    siswa_id INT NOT NULL,
    instruktur_id INT,
    armada_id INT,
    tanggal DATE NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    pertemuan_ke INT NOT NULL DEFAULT 1,
    transmisi VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
    FOREIGN KEY (instruktur_id) REFERENCES instruktur(id) ON DELETE SET NULL,
    FOREIGN KEY (armada_id) REFERENCES armada(id) ON DELETE SET NULL
);

-- ============================================
-- Tabel Absensi
-- ============================================
CREATE TABLE IF NOT EXISTS absensi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jadwal_id INT NOT NULL,
    siswa_id INT NOT NULL,
    tanggal DATE NOT NULL,
    status ENUM('hadir', 'tidak hadir', 'izin') NOT NULL DEFAULT 'hadir',
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jadwal_id) REFERENCES jadwal(id) ON DELETE CASCADE,
    FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE
);

-- ============================================
-- Data Awal: Admin Default
-- ============================================
-- Password: PancaSari@2026!Jaya (hashed with bcrypt)
-- PENTING: Ganti hash ini setelah deploy pertama kali!
INSERT INTO admins (username, password, nama_lengkap) VALUES 
('admin', '$2b$10$/xC_PLACEHOLDER_GANTI_SETELAH_DEPLOY', 'Administrator');

-- ============================================
-- Data Awal: Paket Kursus
-- ============================================
INSERT INTO paket_kursus (nama_paket, deskripsi, jumlah_pertemuan, harga, durasi_per_sesi) VALUES 
('Matic - 3x Pertemuan', 'Paket matic 3 kali pertemuan, durasi 2 jam per sesi', 3, 1000000, 120),
('Matic - 4x Pertemuan', 'Paket matic 4 kali pertemuan, durasi 2 jam per sesi', 4, 1300000, 120),
('Manual - 10x Pertemuan', 'Paket manual 10 kali pertemuan, durasi 1 jam per sesi', 10, 1200000, 60),
('Manual - 8x Pertemuan', 'Paket manual 8 kali pertemuan, durasi 1 jam per sesi', 8, 1000000, 60),
('Manual - 6x Pertemuan', 'Paket manual 6 kali pertemuan, durasi 1 jam per sesi', 6, 800000, 60),
('Matic - 5x Pertemuan', 'Paket matic 5 kali pertemuan, durasi 2 jam per sesi', 5, 1500000, 120),
('Private - Per Pertemuan', 'Paket private per pertemuan, one-on-one dengan instruktur, durasi 2 jam', 1, 350000, 120),
('Kombinasi - 5x Pertemuan', 'Paket kombinasi manual & matic 5 kali pertemuan, durasi 2 jam per sesi', 5, 1500000, 120),
('Kombinasi - 7x Pertemuan', 'Paket kombinasi manual & matic 7 kali pertemuan, durasi 2 jam per sesi', 7, 2000000, 120),
('Manual 10x + SIM', 'Paket manual 10 kali pertemuan plus pembuatan SIM, durasi 1 jam per sesi', 10, 1800000, 60),
('Manual 8x + SIM', 'Paket manual 8 kali pertemuan plus pembuatan SIM, durasi 1 jam per sesi', 8, 1600000, 60),
('Matic 5x + SIM', 'Paket matic 5 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 5, 2100000, 120),
('Matic 4x + SIM', 'Paket matic 4 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 4, 1900000, 120),
('Matic 3x + SIM', 'Paket matic 3 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 3, 1600000, 120),
('Kombinasi 5x + SIM', 'Paket kombinasi 5 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 5, 2100000, 120),
('Kombinasi 7x + SIM', 'Paket kombinasi 7 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 7, 2600000, 120);


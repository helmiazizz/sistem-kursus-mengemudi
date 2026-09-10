const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT) || 3306
    });

    try {
        console.log('🔧 Creating database and tables...');
        
        // Create database
        await connection.query('CREATE DATABASE IF NOT EXISTS kursus_mengemudi');
        await connection.query('USE kursus_mengemudi');

        // Create tables
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                nama_lengkap VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS paket_kursus (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama_paket VARCHAR(100) NOT NULL,
                deskripsi TEXT,
                jumlah_pertemuan INT NOT NULL DEFAULT 5,
                harga DECIMAL(12,2) NOT NULL,
                durasi_per_sesi INT NOT NULL DEFAULT 90,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS siswa (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama_lengkap VARCHAR(100) NOT NULL,
                no_ktp VARCHAR(20),
                tempat_lahir VARCHAR(50),
                tanggal_lahir DATE,
                jenis_kelamin ENUM('Laki-laki', 'Perempuan') NOT NULL,
                alamat TEXT,
                no_telepon VARCHAR(20) NOT NULL,
                email VARCHAR(100),
                paket_id INT,
                status ENUM('pending', 'aktif', 'selesai', 'dibatalkan') DEFAULT 'pending',
                tanggal_daftar TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                catatan TEXT,
                FOREIGN KEY (paket_id) REFERENCES paket_kursus(id) ON DELETE SET NULL
            )
        `);

        // Tabel instruktur (dipertahankan untuk FK jadwal)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS instruktur (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama VARCHAR(100) NOT NULL,
                no_telepon VARCHAR(20),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabel armada (dipertahankan untuk FK jadwal)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS armada (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama_kendaraan VARCHAR(100) NOT NULL,
                nomor_polisi VARCHAR(20) NOT NULL UNIQUE,
                jenis VARCHAR(50) NOT NULL,
                tahun INT,
                warna VARCHAR(30),
                status ENUM('tersedia', 'digunakan', 'maintenance', 'tidak aktif') DEFAULT 'tersedia',
                catatan TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS jadwal (
                id INT AUTO_INCREMENT PRIMARY KEY,
                siswa_id INT NOT NULL,
                instruktur_id INT,
                armada_id INT,
                tanggal DATE NOT NULL,
                jam_mulai TIME NOT NULL,
                jam_selesai TIME NOT NULL,
                pertemuan_ke INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
                FOREIGN KEY (instruktur_id) REFERENCES instruktur(id) ON DELETE SET NULL,
                FOREIGN KEY (armada_id) REFERENCES armada(id) ON DELETE SET NULL
            )
        `);

        await connection.query(`
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
            )
        `);

        console.log('✅ Tables created successfully');

        // Seed admin
        const [existingAdmin] = await connection.query('SELECT id FROM admins WHERE username = ?', ['admin']);
        if (existingAdmin.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await connection.query(
                'INSERT INTO admins (username, password, nama_lengkap) VALUES (?, ?, ?)',
                ['admin', hashedPassword, 'Administrator']
            );
            console.log('Admin account created - change password after first login!');
        } else {
            console.log('Admin account already exists (password not reset)');
        }

        // Seed paket kursus (sinkron dengan index.html & siswa.js)
        const [existingPaket] = await connection.query('SELECT COUNT(*) as count FROM paket_kursus');
        if (existingPaket[0].count === 0) {
            await connection.query(`
                INSERT INTO paket_kursus (nama_paket, deskripsi, jumlah_pertemuan, harga, durasi_per_sesi) VALUES 
                ('Manual - 10x Pertemuan', 'Paket manual lengkap 10 kali pertemuan', 10, 1200000, 60),
                ('Manual - 8x Pertemuan', 'Paket manual standar 8 kali pertemuan', 8, 1000000, 60),
                ('Manual - 6x Pertemuan', 'Paket manual dasar 6 kali pertemuan', 6, 800000, 60),
                ('Matic - 5x Pertemuan', 'Paket matic lengkap 5 kali pertemuan', 5, 1500000, 120),
                ('Matic - 4x Pertemuan', 'Paket matic standar 4 kali pertemuan', 4, 1300000, 120),
                ('Matic - 3x Pertemuan', 'Paket matic dasar 3 kali pertemuan', 3, 1000000, 120),
                ('Private - Per Pertemuan', 'Paket private per pertemuan, one-on-one dengan instruktur', 1, 350000, 120)
            `);
            console.log('✅ Paket kursus seeded (7 paket)');
        }

        // Seed armada default (1 manual, 2 matic = 3 unit)
        const [existingArmada] = await connection.query('SELECT COUNT(*) as count FROM armada');
        if (existingArmada[0].count === 0) {
            await connection.query(`
                INSERT INTO armada (nama_kendaraan, nomor_polisi, jenis, status) VALUES 
                ('Mobil Manual', 'MANUAL-1', 'manual', 'tersedia'),
                ('Mobil Matic 1', 'MATIC-1', 'matic', 'tersedia'),
                ('Mobil Matic 2', 'MATIC-2', 'matic', 'tersedia')
            `);
            console.log('✅ Armada seeded (1 manual, 2 matic = 3 unit)');
        }
        console.log('================================');
        console.log('Admin Login:');
        console.log('  Username: admin');
        console.log('  Password: (set during first seed)');
        console.log('================================\n');

    } catch (error) {
        console.error('❌ Seeding error:', error.message);
    } finally {
        await connection.end();
    }
}

seed();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const app = express();
app.use(compression());

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
    app.set('trust proxy', 1); // Diperlukan agar secure cookies berfungsi di balik reverse proxy Hostinger
}

// ============================================
// Security Middleware
// ============================================

// Helmet: Security headers (XSS, clickjacking, etc)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS: Batasi origin
app.use(cors({
    origin: isProduction ? (process.env.ALLOWED_ORIGIN || true) : true,
    credentials: true
}));

// Body parser dengan limit ukuran (cegah payload besar)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session dengan konfigurasi aman
app.use(session({
    secret: process.env.SESSION_SECRET || 'psj-driving-course-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: isProduction,     // true di HTTPS (production)
        httpOnly: true,           // Cegah akses cookie via JavaScript
        sameSite: 'lax',          // Cegah CSRF
        maxAge: 8 * 60 * 60 * 1000 // 8 jam (bukan 24)
    }
}));

// Rate limiting: Cegah brute force & spam
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 300,                 // Max 300 request per 15 menit (1 halaman = ~5 request)
    message: { success: false, message: 'Terlalu banyak request. Coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit ketat untuk login (cegah brute force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,                  // Max 10 login attempt per 15 menit
    message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit untuk pendaftaran (cegah spam)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 jam
    max: 5,                   // Max 5 pendaftaran per jam per IP
    message: { success: false, message: 'Terlalu banyak pendaftaran. Coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limit ke semua API
app.use('/api/', apiLimiter);

// ============================================
// Static Files
// ============================================
const staticOptions = {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (filePath.includes(path.sep + 'admin' + path.sep) || filePath.includes('/admin/')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filePath.match(/\.(png|jpg|jpeg|gif|webp|ico|svg|css|js|woff|woff2|ttf|eot)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/admin', express.static(path.join(__dirname, 'admin'), { ...staticOptions, index: 'login.html' }));

// ============================================
// API Routes
// ============================================
const authRoutes = require('./routes/auth');
const siswaRoutes = require('./routes/siswa');
const absensiRoutes = require('./routes/absensi');
const jadwalRoutes = require('./routes/jadwal');
const dashboardRoutes = require('./routes/dashboard');
const paketRoutes = require('./routes/paket');
const whatsappRoutes = require('./routes/whatsapp');
const instrukturRoutes = require('./routes/instruktur');
const armadaRoutes = require('./routes/armada');

// Apply rate limiters ketat ke endpoint sensitif
app.use('/api/auth/login', loginLimiter);
app.use('/api/siswa/daftar', registerLimiter);
app.use('/api/siswa/tambah-paket', registerLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/siswa', siswaRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/paket', paketRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/instruktur', instrukturRoutes);
app.use('/api/armada', armadaRoutes);

// Healthcheck & DB diagnostic
app.get('/api/health', async (req, res) => {
    try {
        const db = require('./config/database');
        await db.query('SELECT 1 as ok');
        res.json({ success: true, db: 'connected', envLoaded: !!process.env.DB_NAME });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            db: 'disconnected', 
            error: err.message, 
            code: err.code,
            envLoaded: !!process.env.DB_NAME 
        });
    }
});

// ============================================
// Frontend Routes
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/jadwal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jadwal.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});


// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Halaman tidak ditemukan' });
});

// ============================================
// Error Handler (jangan expose detail error di production)
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: isProduction ? 'Terjadi kesalahan server' : err.message 
    });
});

// ============================================
// Auto Migration
// ============================================
async function runMigrations() {
    try {
        const db = require('./config/database');

        // Use a separate connection with timeout for migrations
        const conn = await db.getConnection();
        await conn.query('SET SESSION lock_wait_timeout = 3');

        // Update status column to support 'selesai'
        try {
            await conn.query("ALTER TABLE siswa MODIFY COLUMN status ENUM('pending','aktif','nonaktif','selesai') DEFAULT 'pending'");
        } catch (e) { /* ignore if already modified or locked */ }

        // Fix paket with jumlah_pertemuan = 0 or NULL
        try {
            const [zeroRows] = await conn.query("SELECT id, nama_paket FROM paket_kursus WHERE jumlah_pertemuan = 0 OR jumlah_pertemuan IS NULL");
            for (const p of zeroRows) {
                const match = p.nama_paket.match(/(\d+)/);
                if (match) {
                    await conn.query("UPDATE paket_kursus SET jumlah_pertemuan = ? WHERE id = ?", [parseInt(match[1]), p.id]);
                } else if (p.nama_paket.toLowerCase().includes('private')) {
                    await conn.query("UPDATE paket_kursus SET jumlah_pertemuan = 1 WHERE id = ?", [p.id]);
                } else {
                    await conn.query("UPDATE paket_kursus SET jumlah_pertemuan = 5 WHERE id = ?", [p.id]);
                }
            }
        } catch (e) { /* ignore */ }

        // Update status = 'selesai' for any student who has completed all meetings
        try {
            await conn.query(`
                UPDATE siswa s
                JOIN (
                    SELECT j.siswa_id, COUNT(DISTINCT a.jadwal_id) as total_hadir
                    FROM absensi a
                    JOIN jadwal j ON a.jadwal_id = j.id
                    WHERE a.status = 'hadir'
                    GROUP BY j.siswa_id
                ) h ON s.id = h.siswa_id
                JOIN paket_kursus pk ON s.paket_id = pk.id
                SET s.status = 'selesai'
                WHERE pk.jumlah_pertemuan > 0 AND h.total_hadir >= pk.jumlah_pertemuan AND s.status != 'selesai'
            `);
        } catch (e) { /* ignore */ }

        // Update Paket Private ke per-pertemuan 350rb
        try {
            await conn.query(
                "UPDATE paket_kursus SET harga = 350000, jumlah_pertemuan = 1, deskripsi = 'Paket private per pertemuan, one-on-one dengan instruktur, durasi 2 jam', durasi_per_sesi = 120 WHERE nama_paket LIKE '%Private%'"
            );
        } catch (e) { /* ignore */ }

        // Drop unused siswa columns (always NULL, never read/written)
        const dropCols = ['no_ktp', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email'];
        for (const col of dropCols) {
            try {
                await conn.query(`ALTER TABLE siswa DROP COLUMN ${col}`);
            } catch (e) { /* ignore if already dropped */ }
        }

        // Add alamat column if not exists
        try {
            await conn.query(`ALTER TABLE siswa ADD COLUMN alamat TEXT NULL`);
        } catch (e) { /* ignore if already exists */ }

        // Add transmisi column to jadwal if not exists
        try {
            await conn.query(`ALTER TABLE jadwal ADD COLUMN transmisi VARCHAR(20) NULL`);
        } catch (e) { /* ignore if already exists */ }

        // Add status_pembayaran column to siswa if not exists
        try {
            await conn.query(`ALTER TABLE siswa ADD COLUMN status_pembayaran ENUM('lunas', 'belum_lunas') DEFAULT 'belum_lunas'`);
            // Set siswa yang sudah aktif / selesai menjadi lunas secara default
            await conn.query(`UPDATE siswa SET status_pembayaran = 'lunas' WHERE status IN ('aktif', 'selesai')`);
        } catch (e) { /* ignore if already exists */ }

        // Add pertemuan_sebelumnya column to siswa if not exists (untuk reset sesi paket baru)
        try {
            await conn.query(`ALTER TABLE siswa ADD COLUMN pertemuan_sebelumnya INT DEFAULT 0`);
        } catch (e) { /* ignore if already exists */ }

        // Add riwayat_paket column to siswa if not exists
        try {
            await conn.query(`ALTER TABLE siswa ADD COLUMN riwayat_paket TEXT NULL`);
        } catch (e) { /* ignore if already exists */ }

        // Insert new packages if not exist
        const newPakets = [
            ['Kombinasi - 5x Pertemuan', 'Paket kombinasi manual & matic 5 kali pertemuan, durasi 2 jam per sesi', 5, 1500000, 120],
            ['Kombinasi - 7x Pertemuan', 'Paket kombinasi manual & matic 7 kali pertemuan, durasi 2 jam per sesi', 7, 2000000, 120],
            ['Manual 10x + SIM', 'Paket manual 10 kali pertemuan plus pembuatan SIM, durasi 1 jam per sesi', 10, 1800000, 60],
            ['Manual 8x + SIM', 'Paket manual 8 kali pertemuan plus pembuatan SIM, durasi 1 jam per sesi', 8, 1600000, 60],
            ['Matic 5x + SIM', 'Paket matic 5 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 5, 2100000, 120],
            ['Matic 4x + SIM', 'Paket matic 4 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 4, 1900000, 120],
            ['Matic 3x + SIM', 'Paket matic 3 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 3, 1600000, 120],
            ['Kombinasi 5x + SIM', 'Paket kombinasi 5 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 5, 2100000, 120],
            ['Kombinasi 7x + SIM', 'Paket kombinasi 7 kali pertemuan plus pembuatan SIM, durasi 2 jam per sesi', 7, 2600000, 120]
        ];

        for (const p of newPakets) {
            try {
                const [exists] = await conn.query("SELECT id FROM paket_kursus WHERE nama_paket = ?", [p[0]]);
                if (exists.length === 0) {
                    await conn.query(
                        "INSERT INTO paket_kursus (nama_paket, deskripsi, jumlah_pertemuan, harga, durasi_per_sesi) VALUES (?, ?, ?, ?, ?)",
                        p
                    );
                }
            } catch (e) { /* ignore insert errors */ }
        }

        // Bersihkan paket_kursus sampah yang berasal dari percobaan injeksi/testing sebelumnya
        try {
            await conn.query("DELETE FROM paket_kursus WHERE nama_paket LIKE '%OR%' OR nama_paket LIKE '%\\'' OR nama_paket LIKE '%\"%'");
        } catch (e) { /* ignore */ }

        // Insert / update default instructors
        // Mas Ivan dihapus / digantikan Mas Adam, nomor WhatsApp Mas Adam belum ada (NULL)
        try {
            const [ivanRows] = await conn.query("SELECT id FROM instruktur WHERE nama LIKE '%Ivan%'");
            if (ivanRows.length > 0) {
                const ivanId = ivanRows[0].id;
                const [jadwalWithIvan] = await conn.query("SELECT COUNT(*) as cnt FROM jadwal WHERE instruktur_id = ?", [ivanId]);
                if (jadwalWithIvan[0].cnt > 0) {
                    await conn.query("UPDATE instruktur SET nama = 'Mas Adam', no_telepon = NULL WHERE id = ?", [ivanId]);
                } else {
                    await conn.query("DELETE FROM instruktur WHERE id = ?", [ivanId]);
                }
            }
        } catch (e) { /* ignore */ }

        const defaultInstructors = [
            ['Mas Danang', '081385359897'],
            ['Mas Adam', null]
        ];
        for (const inst of defaultInstructors) {
            try {
                const [exists] = await conn.query("SELECT id FROM instruktur WHERE nama = ?", [inst[0]]);
                if (exists.length === 0) {
                    await conn.query(
                        "INSERT INTO instruktur (nama, no_telepon, is_active) VALUES (?, ?, 1)",
                        [inst[0], inst[1]]
                    );
                } else if (inst[1] !== null) {
                    // Update nomor telepon jika ada, tetapi JANGAN timpa is_active agar status libur admin tersimpan
                    await conn.query(
                        "UPDATE instruktur SET no_telepon = ? WHERE nama = ?",
                        [inst[1], inst[0]]
                    );
                }
            } catch (e) { /* ignore */ }
        }

        // Seed armada default jika belum ada (1 matic, 2 manual)
        try {
            const [armadaCount] = await conn.query("SELECT COUNT(*) as count FROM armada");
            if (armadaCount[0].count === 0) {
                const defaultArmada = [
                    ['Toyota Agya Matic', 'B 1234 PSJ', 'matic', 2022, 'Putih', 'tersedia', 'Mobil matic utama'],
                    ['Toyota Avanza Manual', 'B 2345 PSJ', 'manual', 2021, 'Silver', 'tersedia', 'Mobil manual unit 1'],
                    ['Daihatsu Xenia Manual', 'B 3456 PSJ', 'manual', 2020, 'Hitam', 'tersedia', 'Mobil manual unit 2']
                ];
                for (const a of defaultArmada) {
                    await conn.query(
                        "INSERT INTO armada (nama_kendaraan, nomor_polisi, jenis, tahun, warna, status, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        a
                    );
                }
            }
        } catch (e) { /* ignore */ }

        conn.release();
        console.log('✅ Migration ready');
    } catch (error) {
        console.log('⚠️ Migration skipped:', error.message);
    }
}

// ============================================
// Start Server
// ============================================
app.listen(PORT, async () => {
    await runMigrations();
    console.log(`
╔══════════════════════════════════════════════╗
║    Kursus Mengemudi - Panca Sari Jaya        ║
║    Server berjalan di http://localhost:${PORT}    ║
╠══════════════════════════════════════════════╣
║    Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}                          ║
╚══════════════════════════════════════════════╝
    `);
});

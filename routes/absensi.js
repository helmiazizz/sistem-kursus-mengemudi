const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// ============================================================
// PUBLIC: Cek sesi latihan aktif hari ini untuk absensi mandiri QR Code
// ============================================================
router.get('/active-session', async (req, res) => {
    try {
        let { no_telepon, armada_id, jadwal_id } = req.query;

        if (!no_telepon) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp wajib diisi' });
        }

        // Normalisasi nomor
        no_telepon = String(no_telepon).replace(/[^0-9]/g, '').trim();

        // Cari data siswa
        const [siswaRows] = await db.query(
            `SELECT s.*, pk.nama_paket, pk.jumlah_pertemuan 
             FROM siswa s 
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
             WHERE REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?`,
            [no_telepon, no_telepon.replace(/^0+/, '')]
        );

        if (siswaRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Nomor WhatsApp tidak terdaftar sebagai siswa PSJ Driving Course.' 
            });
        }

        const siswa = siswaRows[0];

        // Tanggal hari ini di zona waktu Asia/Jakarta
        const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const today = nowJakarta.getFullYear() + '-' + String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + String(nowJakarta.getDate()).padStart(2, '0');

        // Cari semua jadwal siswa untuk hari ini (mendukung 2x atau lebih latihan di hari yang sama untuk semua paket)
        const [jadwalRows] = await db.query(
            `SELECT j.*, 
                    a.nama_kendaraan, a.nomor_polisi, 
                    i.nama as instruktur_nama,
                    ab.id as absensi_id,
                    ab.status as status_absensi,
                    ab.created_at as waktu_absen
             FROM jadwal j
             LEFT JOIN armada a ON j.armada_id = a.id
             LEFT JOIN instruktur i ON j.instruktur_id = i.id
             LEFT JOIN absensi ab ON j.id = ab.jadwal_id
             WHERE j.siswa_id = ? AND j.tanggal = ?
             ORDER BY j.jam_mulai ASC`,
            [siswa.id, today]
        );

        if (jadwalRows.length === 0) {
            const dateDisplay = nowJakarta.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            return res.status(404).json({
                success: false,
                message: `Halo ${siswa.nama_lengkap}, Anda tidak memiliki jadwal latihan mengemudi untuk hari ini (${dateDisplay}).`
            });
        }

        // Waktu saat ini di Jakarta
        const currentHours = nowJakarta.getHours();
        const currentMinutes = nowJakarta.getMinutes();
        const currentTotalMin = currentHours * 60 + currentMinutes;

        // Ambil sesi yang paling relevan saat ini (dukung multi-sesi di hari yang sama untuk semua paket)
        let activeJadwal = null;
        if (jadwal_id) {
            activeJadwal = jadwalRows.find(j => j.id === parseInt(jadwal_id));
        } else if (armada_id) {
            // Prioritaskan sesi armada yang bersangkutan jika scan QR di mobil tertentu
            activeJadwal = jadwalRows.find(j => j.armada_id === parseInt(armada_id) && !j.absensi_id)
                        || jadwalRows.find(j => j.armada_id === parseInt(armada_id));
        }

        if (!activeJadwal) {
            // Prioritaskan sesi yang belum diabsen
            const pendingSessions = jadwalRows.filter(j => !j.absensi_id);
            if (pendingSessions.length > 0) {
                // Cari sesi pending yang sudah masuk jendela waktu (>= start - 30 min)
                const readySession = pendingSessions.find(j => {
                    const [sh, sm] = (j.jam_mulai || '00:00').split(':').map(Number);
                    return currentTotalMin >= (sh * 60 + (sm || 0) - 30);
                });
                activeJadwal = readySession || pendingSessions[0];
            } else {
                // Jika semua sesi hari ini sudah absen, default ke sesi terakhir
                activeJadwal = jadwalRows[jadwalRows.length - 1];
            }
        }

        // Hitung total hadir siswa
        const [absensiRows] = await db.query(
            `SELECT COUNT(DISTINCT a.jadwal_id) as total 
             FROM absensi a 
             JOIN jadwal j ON a.jadwal_id = j.id 
             WHERE j.siswa_id = ? AND a.status = 'hadir'`,
            [siswa.id]
        );
        const totalHadirAll = absensiRows[0]?.total || 0;
        const offset = parseInt(siswa.pertemuan_sebelumnya) || 0;
        const totalHadirAktif = Math.max(0, totalHadirAll - offset);
        const totalPaket = siswa.jumlah_pertemuan || 0;

        // Validasi waktu latihan sesi aktif
        const [startH, startM] = (activeJadwal.jam_mulai || '00:00').split(':').map(Number);
        const startTotalMin = startH * 60 + (startM || 0);

        const isTooEarly = currentTotalMin < (startTotalMin - 30);
        const isSessionActive = currentTotalMin >= (startTotalMin - 30);

        res.json({
            success: true,
            data: {
                siswa: {
                    id: siswa.id,
                    nama_lengkap: siswa.nama_lengkap,
                    no_telepon: siswa.no_telepon,
                    paket: siswa.nama_paket,
                    jumlah_pertemuan: totalPaket,
                    total_hadir: totalHadirAktif
                },
                jadwal: {
                    id: activeJadwal.id,
                    tanggal: activeJadwal.tanggal,
                    jam_mulai: activeJadwal.jam_mulai,
                    jam_selesai: activeJadwal.jam_selesai,
                    pertemuan_ke: activeJadwal.pertemuan_ke,
                    transmisi: activeJadwal.transmisi,
                    instruktur_nama: activeJadwal.instruktur_nama || 'Instruktur PSJ',
                    nama_kendaraan: activeJadwal.nama_kendaraan || 'Armada PSJ',
                    nomor_polisi: activeJadwal.nomor_polisi || ''
                },
                all_sessions_today: jadwalRows.map(j => {
                    const [jH, jM] = (j.jam_mulai || '00:00').split(':').map(Number);
                    const jStartMin = jH * 60 + (jM || 0);
                    const jTooEarly = currentTotalMin < (jStartMin - 30);
                    return {
                        id: j.id,
                        tanggal: j.tanggal,
                        jam_mulai: j.jam_mulai,
                        jam_selesai: j.jam_selesai,
                        pertemuan_ke: j.pertemuan_ke,
                        transmisi: j.transmisi,
                        instruktur_nama: j.instruktur_nama || 'Instruktur PSJ',
                        nama_kendaraan: j.nama_kendaraan || 'Armada PSJ',
                        nomor_polisi: j.nomor_polisi || '',
                        is_absen: !!j.absensi_id,
                        status_absensi: j.status_absensi,
                        waktu_absen: j.waktu_absen,
                        is_too_early: jTooEarly
                    };
                }),
                is_absen: !!activeJadwal.absensi_id,
                status_absensi: activeJadwal.status_absensi,
                waktu_absen: activeJadwal.waktu_absen,
                is_too_early: isTooEarly,
                is_session_active: isSessionActive
            }
        });
    } catch (error) {
        console.error('Active session check error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// PUBLIC: Konfirmasi kehadiran mandiri lewat scan QR Code
// ============================================================
router.post('/qr-checkin', async (req, res) => {
    try {
        let { no_telepon, jadwal_id, armada_id } = req.body;

        if (!no_telepon || !jadwal_id) {
            return res.status(400).json({ success: false, message: 'Data absensi tidak lengkap' });
        }

        no_telepon = String(no_telepon).replace(/[^0-9]/g, '').trim();

        // 1. Verifikasi jadwal & siswa
        const [jadwalRows] = await db.query(
            `SELECT j.*, s.id as siswa_id, s.nama_lengkap, s.no_telepon, s.pertemuan_sebelumnya,
                    pk.nama_paket, pk.jumlah_pertemuan,
                    i.nama as instruktur_nama, i.no_telepon as instruktur_phone,
                    a.nama_kendaraan, a.nomor_polisi
             FROM jadwal j
             JOIN siswa s ON j.siswa_id = s.id
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id
             LEFT JOIN instruktur i ON j.instruktur_id = i.id
             LEFT JOIN armada a ON j.armada_id = a.id
             WHERE j.id = ? AND (
                 REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                 OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?
             )`,
            [jadwal_id, no_telepon, no_telepon.replace(/^0+/, '')]
        );

        if (jadwalRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Jadwal latihan tidak ditemukan atau tidak sesuai data siswa.' });
        }

        const j = jadwalRows[0];

        // 2. Verifikasi tanggal (harus hari ini di Asia/Jakarta)
        const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const todayStr = nowJakarta.getFullYear() + '-' + String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + String(nowJakarta.getDate()).padStart(2, '0');
        const jadwalTglStr = String(j.tanggal).split('T')[0];

        if (jadwalTglStr !== todayStr) {
            return res.status(400).json({ 
                success: false, 
                message: 'Absensi hanya dapat dilakukan pada tanggal jadwal latihan yang bersangkutan.' 
            });
        }

        // 3. Cek apakah sudah pernah diabsen sebelumnya
        const [existing] = await db.query('SELECT id, status FROM absensi WHERE jadwal_id = ?', [jadwal_id]);
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Jadwal latihan Pertemuan Ke-${j.pertemuan_ke} ini sudah pernah diabsen dengan status: ${existing[0].status.toUpperCase()}.` 
            });
        }

        // 4. Catat kehadiran ke tabel absensi
        await db.query(
            'INSERT INTO absensi (jadwal_id, siswa_id, tanggal, status, catatan) VALUES (?, ?, ?, "hadir", "Absensi Mandiri (QR Code)")',
            [jadwal_id, j.siswa_id, todayStr]
        );

        // 5. Hitung total hadir terbaru & auto update status siswa jika tamat paket
        const [countHadir] = await db.query(
            `SELECT COUNT(DISTINCT a.jadwal_id) as total 
             FROM absensi a 
             JOIN jadwal jd ON a.jadwal_id = jd.id 
             WHERE jd.siswa_id = ? AND a.status = 'hadir'`,
            [j.siswa_id]
        );
        const totalHadirAll = countHadir[0]?.total || 0;
        const offset = parseInt(j.pertemuan_sebelumnya) || 0;
        const totalHadirAktif = Math.max(0, totalHadirAll - offset);
        const totalPaket = j.jumlah_pertemuan || 0;
        const isComplete = totalPaket > 0 && totalHadirAktif >= totalPaket;

        if (isComplete) {
            await db.query('UPDATE siswa SET status = "selesai" WHERE id = ?', [j.siswa_id]).catch(() => {});
        }

        // 6. Kirim notifikasi WA ucapan terima kasih & progres sesi via Fonnte
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                let targetPhone = no_telepon;
                if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.substring(1);
                if (!targetPhone.startsWith('62')) targetPhone = '62' + targetPhone;

                const tglFormatted = new Date(j.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                });

                const sisaPertemuan = Math.max(0, totalPaket - totalHadirAktif);
                const progressText = isComplete
                    ? `🎉 *Selamat! Anda telah menyelesaikan seluruh kuota paket latihan (${totalHadirAktif}/${totalPaket} Sesi).*`
                    : `Sisa kuota latihan Anda: *${sisaPertemuan}x pertemuan* lagi.`;

                const waMessage = `✅ *ABSENSI LATIHAN BERHASIL*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${j.nama_lengkap}* 👋

Terima kasih! Absensi mandiri untuk sesi latihan Anda telah *berhasil dicatat*:

🔢 *Pertemuan Ke-${j.pertemuan_ke}*
📆 Tanggal: *${tglFormatted}*
⏰ Jam: *${j.jam_mulai.slice(0, 5)} - ${j.jam_selesai.slice(0, 5)}*
⚙️ Transmisi: *${j.transmisi || '-'}*
👨‍🏫 Instruktur: *${j.instruktur_nama || '-'}*
🚗 Armada: *${j.nama_kendaraan || '-'} (${j.nomor_polisi || '-'})*

📊 *Status Progres Latihan:*
${totalHadirAktif} / ${totalPaket} Sesi Selesai
${progressText}

Terima kasih telah memilih *PSJ Driving Course*! Tetap semangat dan selalu utamakan keselamatan berkendara 🚗🙏`;

                await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: targetPhone, message: waMessage, typing: false })
                });
            }
        } catch (waErr) {
            console.error('WA QR checkin notification error (non-fatal):', waErr.message);
        }

        res.json({
            success: true,
            message: `Absensi Pertemuan Ke-${j.pertemuan_ke} berhasil dicatat! Terima kasih telah berlatih hari ini.`,
            data: {
                jadwal_id: j.id,
                pertemuan_ke: j.pertemuan_ke,
                jam_mulai: j.jam_mulai,
                jam_selesai: j.jam_selesai,
                total_hadir: totalHadirAktif,
                total_sesi: totalPaket,
                is_complete: isComplete
            }
        });
    } catch (error) {
        console.error('QR checkin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// ADMIN: Get all absensi (with filters)
// ============================================================
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { tanggal, siswa_id } = req.query;
        let query = `
            SELECT a.*, s.nama_lengkap, j.pertemuan_ke, j.jam_mulai, j.jam_selesai,
                   i.nama as instruktur_nama, ar.nama_kendaraan, ar.nomor_polisi
            FROM absensi a
            JOIN siswa s ON a.siswa_id = s.id
            JOIN jadwal j ON a.jadwal_id = j.id
            LEFT JOIN instruktur i ON j.instruktur_id = i.id
            LEFT JOIN armada ar ON j.armada_id = ar.id
        `;
        const params = [];
        const conditions = [];

        if (tanggal) {
            conditions.push('a.tanggal = ?');
            params.push(tanggal);
        }
        if (siswa_id) {
            conditions.push('a.siswa_id = ?');
            params.push(siswa_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY a.tanggal DESC, j.jam_mulai ASC';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get absensi error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create absensi
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { jadwal_id, siswa_id, tanggal, status, catatan } = req.body;

        const allowedStatuses = ['hadir', 'tidak hadir', 'izin'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status absensi tidak valid' });
        }

        const cleanTanggal = String(tanggal).split('T')[0];

        // Check for duplicate / existing absensi per jadwal_id
        const [existing] = await db.query(
            'SELECT id FROM absensi WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (existing.length > 0) {
            // Update existing
            await db.query(
                'UPDATE absensi SET status = ?, catatan = ?, tanggal = ?, siswa_id = ? WHERE jadwal_id = ?',
                [status, catatan || null, cleanTanggal, siswa_id, jadwal_id]
            );
        } else {
            await db.query(
                'INSERT INTO absensi (jadwal_id, siswa_id, tanggal, status, catatan) VALUES (?, ?, ?, ?, ?)',
                [jadwal_id, siswa_id, cleanTanggal, status, catatan || null]
            );
        }

        // Auto-check & update status siswa ke 'selesai' jika seluruh pertemuan sudah hadir
        if (siswa_id) {
            try {
                const [checkRows] = await db.query(
                    `SELECT s.id, s.status, pk.jumlah_pertemuan,
                            (SELECT COUNT(DISTINCT j.id) 
                             FROM jadwal j 
                             JOIN absensi a ON j.id = a.jadwal_id 
                             WHERE j.siswa_id = s.id AND a.status = 'hadir') as total_hadir
                     FROM siswa s
                     LEFT JOIN paket_kursus pk ON s.paket_id = pk.id
                     WHERE s.id = ?`,
                    [siswa_id]
                );

                if (checkRows.length > 0) {
                    const { total_hadir, jumlah_pertemuan, status: currentStatus } = checkRows[0];
                    const maxMeet = jumlah_pertemuan || 5;
                    if (total_hadir >= maxMeet && currentStatus !== 'selesai') {
                        await db.query('UPDATE siswa SET status = "selesai" WHERE id = ?', [siswa_id]);
                    } else if (total_hadir < maxMeet && currentStatus === 'selesai') {
                        await db.query('UPDATE siswa SET status = "aktif" WHERE id = ?', [siswa_id]);
                    }
                }
            } catch (checkErr) {
                console.error('Auto update status error:', checkErr);
            }
        }

        res.json({ success: true, message: 'Absensi berhasil dicatat' });
    } catch (error) {
        console.error('Create absensi error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// Get all absensi (with filters)
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

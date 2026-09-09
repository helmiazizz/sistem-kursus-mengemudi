const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// Dashboard statistics
router.get('/stats', isAuthenticated, async (req, res) => {
    try {
        const [totalSiswa] = await db.query("SELECT COUNT(*) as count FROM siswa");
        const [siswaAktif] = await db.query("SELECT COUNT(*) as count FROM siswa WHERE status = 'aktif'");
        const [siswaSelesai] = await db.query("SELECT COUNT(*) as count FROM siswa WHERE status = 'selesai'");
        const [siswaPending] = await db.query("SELECT COUNT(*) as count FROM siswa WHERE status = 'pending'");
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const [jadwalHariIni] = await db.query("SELECT COUNT(*) as count FROM jadwal WHERE tanggal = ?", [todayStr]);

        // Today's schedule
        const [todaySchedule] = await db.query(`
            SELECT j.*, s.nama_lengkap
            FROM jadwal j
            JOIN siswa s ON j.siswa_id = s.id
            WHERE j.tanggal = ?
            ORDER BY j.jam_mulai ASC
        `, [todayStr]);

        res.json({
            success: true,
            data: {
                total_siswa: totalSiswa[0].count,
                siswa_aktif: siswaAktif[0].count,
                siswa_selesai: siswaSelesai[0].count,
                siswa_pending: siswaPending[0].count,
                jadwal_hari_ini: jadwalHariIni[0].count,
                today_schedule: todaySchedule
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

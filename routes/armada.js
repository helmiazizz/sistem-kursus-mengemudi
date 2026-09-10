const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// ============================================================
// GET /: Ringkasan armada tersedia (Publik, untuk kalender & booking)
// ============================================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, nama_kendaraan, nomor_polisi, jenis, status FROM armada WHERE status = "tersedia" ORDER BY jenis, nama_kendaraan'
        );

        const manualCount = rows.filter(a => a.jenis && a.jenis.toLowerCase() === 'manual').length;
        const maticCount = rows.filter(a => a.jenis && a.jenis.toLowerCase() === 'matic').length;

        res.json({
            success: true,
            data: rows,
            capacity: {
                manual: manualCount,
                matic: maticCount,
                total: rows.length
            }
        });
    } catch (error) {
        console.error('Get public armada error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// GET /all: Semua armada (Admin, termasuk yang maintenance / nonaktif)
// ============================================================
router.get('/all', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM armada ORDER BY jenis ASC, nama_kendaraan ASC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get all armada error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// POST /: Tambah armada baru (Admin)
// ============================================================
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { nama_kendaraan, nomor_polisi, jenis, tahun, warna, status, catatan } = req.body;

        if (!nama_kendaraan || !nomor_polisi || !jenis) {
            return res.status(400).json({ success: false, message: 'Nama kendaraan, plat nomor, dan jenis transmisi wajib diisi' });
        }

        const validJenis = ['manual', 'matic'];
        const cleanJenis = jenis.toLowerCase().trim();
        if (!validJenis.includes(cleanJenis)) {
            return res.status(400).json({ success: false, message: 'Jenis transmisi harus "manual" atau "matic"' });
        }

        const validStatus = ['tersedia', 'digunakan', 'maintenance', 'tidak aktif'];
        const cleanStatus = status && validStatus.includes(status.toLowerCase()) ? status.toLowerCase() : 'tersedia';

        const [existing] = await db.query('SELECT id FROM armada WHERE nomor_polisi = ?', [nomor_polisi.trim().toUpperCase()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: `Nomor polisi ${nomor_polisi} sudah terdaftar` });
        }

        const [result] = await db.query(
            'INSERT INTO armada (nama_kendaraan, nomor_polisi, jenis, tahun, warna, status, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nama_kendaraan.trim(), nomor_polisi.trim().toUpperCase(), cleanJenis, tahun ? parseInt(tahun) : null, warna ? warna.trim() : null, cleanStatus, catatan ? catatan.trim() : null]
        );

        res.status(201).json({
            success: true,
            message: 'Armada berhasil ditambahkan',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create armada error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// PUT /:id: Edit informasi armada (Admin)
// ============================================================
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { nama_kendaraan, nomor_polisi, jenis, tahun, warna, status, catatan } = req.body;

        if (!nama_kendaraan || !nomor_polisi || !jenis) {
            return res.status(400).json({ success: false, message: 'Nama kendaraan, plat nomor, dan jenis transmisi wajib diisi' });
        }

        const validJenis = ['manual', 'matic'];
        const cleanJenis = jenis.toLowerCase().trim();
        if (!validJenis.includes(cleanJenis)) {
            return res.status(400).json({ success: false, message: 'Jenis transmisi harus "manual" atau "matic"' });
        }

        const validStatus = ['tersedia', 'digunakan', 'maintenance', 'tidak aktif'];
        const cleanStatus = status && validStatus.includes(status.toLowerCase()) ? status.toLowerCase() : 'tersedia';

        const [dupCheck] = await db.query('SELECT id FROM armada WHERE nomor_polisi = ? AND id != ?', [nomor_polisi.trim().toUpperCase(), id]);
        if (dupCheck.length > 0) {
            return res.status(400).json({ success: false, message: `Nomor polisi ${nomor_polisi} sudah digunakan armada lain` });
        }

        await db.query(
            'UPDATE armada SET nama_kendaraan = ?, nomor_polisi = ?, jenis = ?, tahun = ?, warna = ?, status = ?, catatan = ? WHERE id = ?',
            [nama_kendaraan.trim(), nomor_polisi.trim().toUpperCase(), cleanJenis, tahun ? parseInt(tahun) : null, warna ? warna.trim() : null, cleanStatus, catatan ? catatan.trim() : null, id]
        );

        res.json({ success: true, message: 'Data armada berhasil diperbarui' });
    } catch (error) {
        console.error('Update armada error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// PUT /:id/status: Ubah status armada secara cepat (Admin)
// ============================================================
router.put('/:id/status', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatus = ['tersedia', 'digunakan', 'maintenance', 'tidak aktif'];
        if (!status || !validStatus.includes(status.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Status armada tidak valid' });
        }

        const cleanStatus = status.toLowerCase();
        await db.query('UPDATE armada SET status = ? WHERE id = ?', [cleanStatus, id]);

        res.json({
            success: true,
            message: `Status armada berhasil diubah menjadi "${cleanStatus}"`,
            data: { id: Number(id), status: cleanStatus }
        });
    } catch (error) {
        console.error('Update armada status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// DELETE /:id: Hapus armada (Admin)
// ============================================================
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT nama_kendaraan FROM armada WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Armada tidak ditemukan' });
        }

        // Cek apakah armada memiliki riwayat jadwal
        const [jadwalCount] = await db.query('SELECT COUNT(*) as total FROM jadwal WHERE armada_id = ?', [id]);
        if (jadwalCount[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: 'Armada tidak dapat dihapus karena sudah memiliki riwayat jadwal latihan. Silakan ubah status menjadi "Maintenance" atau "Tidak Aktif".'
            });
        }

        await db.query('DELETE FROM armada WHERE id = ?', [id]);
        res.json({ success: true, message: `Armada ${existing[0].nama_kendaraan} berhasil dihapus` });
    } catch (error) {
        console.error('Delete armada error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

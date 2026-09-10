const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// ============================================================
// GET /: Daftar instruktur aktif (publik, untuk dropdown siswa)
// ============================================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, nama FROM instruktur WHERE is_active = 1 ORDER BY nama ASC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// GET /all: Daftar semua instruktur (aktif & nonaktif) untuk admin
// ============================================================
router.get('/all', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, nama, no_telepon, is_active, created_at FROM instruktur ORDER BY nama ASC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get all instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// POST /: Tambah instruktur baru (admin)
// ============================================================
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { nama, no_telepon } = req.body;

        if (!nama || typeof nama !== 'string' || !nama.trim()) {
            return res.status(400).json({ success: false, message: 'Nama instruktur wajib diisi' });
        }

        const cleanNama = nama.trim();
        const cleanPhone = no_telepon && typeof no_telepon === 'string' ? no_telepon.trim() : null;

        const [result] = await db.query(
            'INSERT INTO instruktur (nama, no_telepon, is_active) VALUES (?, ?, 1)',
            [cleanNama, cleanPhone]
        );

        res.status(201).json({
            success: true,
            message: 'Instruktur berhasil ditambahkan',
            data: {
                id: result.insertId,
                nama: cleanNama,
                no_telepon: cleanPhone,
                is_active: 1
            }
        });
    } catch (error) {
        console.error('Create instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// PUT /:id: Update data instruktur (admin)
// ============================================================
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, no_telepon } = req.body;

        if (!nama || typeof nama !== 'string' || !nama.trim()) {
            return res.status(400).json({ success: false, message: 'Nama instruktur wajib diisi' });
        }

        const [existing] = await db.query('SELECT * FROM instruktur WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Instruktur tidak ditemukan' });
        }

        const cleanNama = nama.trim();
        const cleanPhone = no_telepon !== undefined
            ? (no_telepon && typeof no_telepon === 'string' ? no_telepon.trim() : null)
            : existing[0].no_telepon;

        await db.query(
            'UPDATE instruktur SET nama = ?, no_telepon = ? WHERE id = ?',
            [cleanNama, cleanPhone, id]
        );

        res.json({
            success: true,
            message: 'Data instruktur berhasil diperbarui',
            data: {
                id: Number(id),
                nama: cleanNama,
                no_telepon: cleanPhone,
                is_active: existing[0].is_active
            }
        });
    } catch (error) {
        console.error('Update instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// PUT /:id/toggle: Toggle status aktif/libur instruktur (admin)
// ============================================================
router.put('/:id/toggle', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT id, nama, is_active FROM instruktur WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Instruktur tidak ditemukan' });
        }

        const currentStatus = existing[0].is_active ? 1 : 0;
        const newStatus = currentStatus === 1 ? 0 : 1;

        await db.query('UPDATE instruktur SET is_active = ? WHERE id = ?', [newStatus, id]);

        const statusLabel = newStatus === 1 ? 'aktif' : 'libur';
        res.json({
            success: true,
            message: `Status instruktur ${existing[0].nama} berhasil diubah menjadi ${statusLabel}`,
            data: {
                id: existing[0].id,
                nama: existing[0].nama,
                is_active: newStatus
            }
        });
    } catch (error) {
        console.error('Toggle instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// DELETE /:id: Hapus instruktur (admin)
// ============================================================
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT id, nama FROM instruktur WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Instruktur tidak ditemukan' });
        }

        // Cek apakah instruktur memiliki riwayat jadwal
        const [jadwalCount] = await db.query(
            'SELECT COUNT(*) as total FROM jadwal WHERE instruktur_id = ?',
            [id]
        );

        if (jadwalCount[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: 'Instruktur tidak dapat dihapus karena memiliki riwayat jadwal. Silakan ubah status menjadi libur/nonaktif.'
            });
        }

        await db.query('DELETE FROM instruktur WHERE id = ?', [id]);

        res.json({
            success: true,
            message: `Instruktur ${existing[0].nama} berhasil dihapus`
        });
    } catch (error) {
        console.error('Delete instruktur error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

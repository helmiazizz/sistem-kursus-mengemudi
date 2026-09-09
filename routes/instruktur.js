const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET: Daftar instruktur aktif (publik, untuk dropdown siswa)
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

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// PUBLIC: Get all active paket kursus
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM paket_kursus WHERE is_active = TRUE ORDER BY harga ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get paket error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

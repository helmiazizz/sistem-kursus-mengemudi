const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

// Auth middleware
function isAuthenticated(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Input validation
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
        }
        
        const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Username atau password salah' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Username atau password salah' });
        }

        // Session regeneration to prevent session fixation
        const adminData = { id: admin.id, username: admin.username, nama_lengkap: admin.nama_lengkap };
        req.session.regenerate((err) => {
            if (err) return res.status(500).json({ success: false, message: 'Session error' });
            req.session.admin = adminData;
            req.session.save((err) => {
                if (err) return res.status(500).json({ success: false, message: 'Session error' });
                res.json({ success: true, message: 'Login berhasil' });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logout berhasil' });
});

// Check session
router.get('/check', (req, res) => {
    if (req.session && req.session.admin) {
        res.json({ success: true, admin: req.session.admin });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
});

module.exports = router;
module.exports.isAuthenticated = isAuthenticated;

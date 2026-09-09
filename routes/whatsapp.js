const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./auth');

// Send WhatsApp message via Fonnte API
router.post('/send', isAuthenticated, async (req, res) => {
    try {
        const { target, message } = req.body;

        if (!target || !message) {
            return res.status(400).json({ success: false, message: 'Nomor tujuan dan pesan wajib diisi' });
        }

        const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
        if (!token) {
            return res.status(500).json({ success: false, message: 'Fonnte token belum dikonfigurasi di server' });
        }

        // Format nomor ke format internasional
        let phone = target.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) {
            phone = '62' + phone.substring(1);
        }
        if (!phone.startsWith('62')) {
            phone = '62' + phone;
        }

        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: phone,
                message: message,
                typing: false
            })
        });

        const result = await response.json();

        if (result.status) {
            res.json({ success: true, message: 'Pesan WhatsApp berhasil dikirim', data: result });
        } else {
            console.error('Fonnte error:', result);
            res.status(400).json({ success: false, message: result.reason || 'Gagal mengirim pesan', data: result });
        }
    } catch (error) {
        console.error('WhatsApp send error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
    }
});

// Send bulk WhatsApp messages
router.post('/send-bulk', isAuthenticated, async (req, res) => {
    try {
        const { messages } = req.body; // Array of { target, message }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ success: false, message: 'Data pesan tidak valid' });
        }

        const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
        if (!token) {
            return res.status(500).json({ success: false, message: 'Fonnte token belum dikonfigurasi di server' });
        }

        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const msg of messages) {
            try {
                let phone = msg.target.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (!phone.startsWith('62')) phone = '62' + phone;

                const response = await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        target: phone,
                        message: msg.message,
                        typing: false
                    })
                });

                const result = await response.json();
                if (result.status) {
                    successCount++;
                } else {
                    failCount++;
                }
                results.push({ target: phone, success: result.status, detail: result });

                // Delay antar pesan agar tidak kena rate limit
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                failCount++;
                results.push({ target: msg.target, success: false, detail: err.message });
            }
        }

        res.json({
            success: true,
            message: `${successCount} pesan berhasil, ${failCount} gagal`,
            successCount,
            failCount,
            results
        });
    } catch (error) {
        console.error('Bulk WhatsApp send error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
    }
});

module.exports = router;

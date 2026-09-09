const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// Get all jadwal
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { tanggal, siswa_id } = req.query;
        let query = `
            SELECT j.*, s.nama_lengkap, s.no_telepon, s.alamat, i.nama as instruktur_nama, 
                   a.nama_kendaraan, a.nomor_polisi,
                   ab.id as absensi_id, ab.status as status_absensi, ab.catatan as catatan_absensi
            FROM jadwal j
            JOIN siswa s ON j.siswa_id = s.id
            LEFT JOIN instruktur i ON j.instruktur_id = i.id
            LEFT JOIN armada a ON j.armada_id = a.id
            LEFT JOIN absensi ab ON (j.id = ab.jadwal_id OR (ab.siswa_id = j.siswa_id AND ab.tanggal = j.tanggal))
        `;
        const params = [];
        const conditions = [];

        if (tanggal) {
            conditions.push('j.tanggal = ?');
            params.push(tanggal);
        }
        if (siswa_id) {
            conditions.push('j.siswa_id = ?');
            params.push(siswa_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY j.tanggal DESC, j.jam_mulai ASC';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get jadwal error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create jadwal
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { siswa_id, instruktur_id, armada_id, tanggal, jam_mulai, jam_selesai, pertemuan_ke } = req.body;

        if (!siswa_id || !tanggal || !jam_mulai || !jam_selesai) {
            return res.status(400).json({ success: false, message: 'Data jadwal tidak lengkap' });
        }

        const [result] = await db.query(
            'INSERT INTO jadwal (siswa_id, instruktur_id, armada_id, tanggal, jam_mulai, jam_selesai, pertemuan_ke) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [siswa_id, instruktur_id || null, armada_id || null, tanggal, jam_mulai, jam_selesai, pertemuan_ke || 1]
        );

        res.json({ success: true, message: 'Jadwal berhasil dibuat', id: result.insertId });
    } catch (error) {
        console.error('Create jadwal error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update jadwal
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { siswa_id, instruktur_id, armada_id, tanggal, jam_mulai, jam_selesai, pertemuan_ke } = req.body;
        await db.query(
            'UPDATE jadwal SET siswa_id = ?, instruktur_id = ?, armada_id = ?, tanggal = ?, jam_mulai = ?, jam_selesai = ?, pertemuan_ke = ? WHERE id = ?',
            [siswa_id, instruktur_id, armada_id, tanggal, jam_mulai, jam_selesai, pertemuan_ke, req.params.id]
        );
        res.json({ success: true, message: 'Jadwal berhasil diperbarui' });
    } catch (error) {
        console.error('Update jadwal error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete jadwal
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        await db.query('DELETE FROM absensi WHERE jadwal_id = ?', [req.params.id]);
        await db.query('DELETE FROM jadwal WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        console.error('Delete jadwal error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus jadwal' });
    }
});

// PUBLIC: Siswa cek jadwal via no telepon
router.get('/siswa-jadwal', async (req, res) => {
    try {
        let { no_telepon } = req.query;
        if (!no_telepon) {
            return res.status(400).json({ success: false, message: 'No. WhatsApp wajib diisi' });
        }

        // Normalisasi: hapus spasi, strip, hanya angka
        no_telepon = no_telepon.replace(/[^0-9]/g, '').trim();

        // Cari siswa berdasarkan no telepon (coba exact match, lalu tanpa leading 0)
        let [siswaRows] = await db.query(
            `SELECT s.*, pk.nama_paket, pk.jumlah_pertemuan 
             FROM siswa s 
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
             WHERE REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?`,
            [no_telepon, no_telepon.replace(/^0+/, '')]
        );

        if (siswaRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan. Pastikan nomor WhatsApp sesuai dengan yang didaftarkan.' });
        }

        const siswa = siswaRows[0];

        // Ambil jadwal siswa lengkap dengan status absensinya
        const [jadwalRows] = await db.query(
            `SELECT j.*, 
                    a.nama_kendaraan, a.nomor_polisi, 
                    i.nama as instruktur_nama,
                    ab.id as absensi_id,
                    ab.status as status_absensi,
                    ab.catatan as catatan_absensi
             FROM jadwal j
             LEFT JOIN armada a ON j.armada_id = a.id
             LEFT JOIN instruktur i ON j.instruktur_id = i.id
             LEFT JOIN absensi ab ON j.id = ab.jadwal_id
             WHERE j.siswa_id = ?
             ORDER BY j.tanggal ASC, j.jam_mulai ASC`,
            [siswa.id]
        );

        // Ambil data absensi
        const [absensiRows] = await db.query(
            `SELECT ab.*, j.tanggal, j.pertemuan_ke 
             FROM absensi ab 
             JOIN jadwal j ON ab.jadwal_id = j.id 
             WHERE ab.siswa_id = ?`,
            [siswa.id]
        );

        // Hitung total hadir untuk paket aktif (mengurangi pertemuan_sebelumnya jika sudah tambah paket)
        const totalHadirAll = absensiRows.filter(a => a.status === 'hadir').length;
        const offset = parseInt(siswa.pertemuan_sebelumnya) || 0;
        const totalHadirAktif = Math.max(0, totalHadirAll - offset);
        const totalPaket = siswa.jumlah_pertemuan || 0;
        const isComplete = totalPaket > 0 && totalHadirAktif >= totalPaket;
        let finalStatus = siswa.status;

        if (isComplete && siswa.status !== 'selesai') {
            finalStatus = 'selesai';
            await db.query('UPDATE siswa SET status = "selesai" WHERE id = ?', [siswa.id]).catch(() => {});
        } else if (!isComplete && siswa.status === 'selesai') {
            finalStatus = 'aktif';
            await db.query('UPDATE siswa SET status = "aktif" WHERE id = ?', [siswa.id]).catch(() => {});
        }

        res.json({
            success: true,
            data: {
                siswa: {
                    id: siswa.id,
                    nama: siswa.nama_lengkap,
                    no_telepon: siswa.no_telepon,
                    paket: siswa.nama_paket,
                    jumlah_pertemuan: totalPaket,
                    total_hadir: totalHadirAktif,
                    total_hadir_semua: totalHadirAll,
                    pertemuan_sebelumnya: offset,
                    status: finalStatus,
                    status_pembayaran: siswa.status_pembayaran || 'belum_lunas',
                    tanggal_daftar: siswa.tanggal_daftar
                },
                jadwal: jadwalRows,
                absensi: absensiRows
            }
        });
    } catch (error) {
        console.error('Get siswa jadwal error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUBLIC: Get semua slot yang sudah dibooking (untuk kalender)
router.get('/booked-slots', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT j.tanggal, j.jam_mulai, j.jam_selesai, j.instruktur_id, i.nama as instruktur_nama, s.nama_lengkap 
             FROM jadwal j 
             JOIN siswa s ON j.siswa_id = s.id
             LEFT JOIN instruktur i ON j.instruktur_id = i.id
             WHERE j.tanggal >= CURDATE()
             ORDER BY j.tanggal, j.jam_mulai`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get booked slots error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUBLIC: Siswa request jadwal baru
router.post('/siswa-request', async (req, res) => {
    try {
        let { no_telepon, tanggal, jam_mulai, instruktur_id, transmisi } = req.body;

        if (!no_telepon || !tanggal || !jam_mulai || !instruktur_id) {
            return res.status(400).json({ success: false, message: 'Pilihan Instruktur wajib diisi' });
        }

        // Normalisasi nomor
        no_telepon = no_telepon.replace(/[^0-9]/g, '').trim();

        // Cari siswa
        let [siswaRows] = await db.query(
            `SELECT id, nama_lengkap, status, status_pembayaran, alamat, pertemuan_sebelumnya FROM siswa 
             WHERE REPLACE(REPLACE(no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(no_telepon, ' ', ''), '-', '') = ?`,
            [no_telepon, no_telepon.replace(/^0+/, '')]);
        if (siswaRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
        }

        const siswa = siswaRows[0];

        // Cek status siswa: jika pending (pendaftaran awal belum disetujui admin)
        if (siswa.status === 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Pendaftaran Anda belum dikonfirmasi. Silakan hubungi admin via WhatsApp terlebih dahulu.' 
            });
        }

        // Hitung pertemuan ke berapa untuk paket aktif (mengabaikan 'tidak hadir' atau 'izin')
        const [countRows] = await db.query(
            `SELECT COUNT(j.id) as total 
             FROM jadwal j
             LEFT JOIN absensi a ON j.id = a.jadwal_id
             WHERE j.siswa_id = ? AND (a.status IS NULL OR a.status = 'hadir')`,
            [siswa.id]
        );

        const totalJadwalAll = countRows[0].total || 0;
        const offset = parseInt(siswa.pertemuan_sebelumnya) || 0;
        const pertemuan_ke = Math.max(1, (totalJadwalAll - offset) + 1);

        // Cek paket siswa (untuk durasi dan batas pertemuan)
        const [paketRows] = await db.query(
            `SELECT s.paket_id, pk.jumlah_pertemuan, pk.nama_paket, pk.durasi_per_sesi 
             FROM siswa s 
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
             WHERE s.id = ?`,
            [siswa.id]
        );

        if (paketRows.length > 0 && paketRows[0].jumlah_pertemuan > 0) {
            if (pertemuan_ke > paketRows[0].jumlah_pertemuan) {
                return res.status(400).json({
                    success: false,
                    message: `Kuota latihan paket Anda sudah selesai (${paketRows[0].jumlah_pertemuan}x pertemuan). Silakan pilih paket baru di bawah untuk menambah jadwal.`
                });
            }
        }

        // Durasi dinamis: matic, private, kombinasi = 120 menit, manual = 60 menit
        let durasi = 60; // default manual
        if (paketRows.length > 0 && paketRows[0].nama_paket) {
            const namaPaket = paketRows[0].nama_paket.toLowerCase();
            if (namaPaket.includes('matic') || namaPaket.includes('private') || namaPaket.includes('kombinasi')) {
                durasi = 120;
            }
        }

        let finalTransmisi = transmisi;
        if (!finalTransmisi && paketRows.length > 0 && paketRows[0].nama_paket) {
            const namaPaket = paketRows[0].nama_paket.toLowerCase();
            if (namaPaket.includes('manual')) {
                finalTransmisi = 'Manual';
            } else if (namaPaket.includes('matic')) {
                finalTransmisi = 'Matic';
            } else {
                finalTransmisi = 'Manual';
            }
        }

        // Hitung jam selesai berdasarkan durasi paket
        const [hours, minutes] = jam_mulai.split(':').map(Number);
        const endDate = new Date(2000, 0, 1, hours, minutes + durasi);
        const jam_selesai = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

        // Cek jika booking hari ini tapi jam sudah lewat
        const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const todayStr = nowJakarta.getFullYear() + '-' + String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + String(nowJakarta.getDate()).padStart(2, '0');
        if (tanggal === todayStr) {
            const currentHour = nowJakarta.getHours();
            const currentMinute = nowJakarta.getMinutes();
            if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
                return res.status(400).json({
                    success: false,
                    message: 'Jam yang dipilih sudah lewat. Silakan pilih jam yang belum lewat atau pilih tanggal lain.'
                });
            }
        }

        if (paketRows.length > 0 && paketRows[0].paket_id && paketRows[0].jumlah_pertemuan) {
            const maxPertemuan = paketRows[0].jumlah_pertemuan;
            if (pertemuan_ke > maxPertemuan) {
                return res.status(400).json({
                    success: false,
                    message: `Anda sudah mencapai batas ${maxPertemuan} pertemuan sesuai paket ${paketRows[0].nama_paket}. Tidak dapat booking jadwal lagi.`
                });
            }
        }

        // Validasi Instruktur Mengajar
        if (!instruktur_id) {
            return res.status(400).json({ success: false, message: 'Silakan pilih instruktur mengemudi' });
        }
        const finalInstrukturId = parseInt(instruktur_id);

        // Cek konflik jam mengajar instruktur terpilih
        const [conflicts] = await db.query(
            `SELECT COUNT(*) as cnt FROM jadwal 
             WHERE tanggal = ? AND instruktur_id = ? AND (
                 jam_mulai < ? AND jam_selesai > ?
             )`,
            [tanggal, finalInstrukturId, jam_selesai, jam_mulai]
        );

        if (conflicts[0].cnt >= 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Instruktur yang Anda pilih sudah memiliki jadwal mengajar di rentang jam tersebut. Silakan pilih instruktur lain atau jam lain.' 
            });
        }

        // Simpan jadwal
        const [result] = await db.query(
            'INSERT INTO jadwal (siswa_id, instruktur_id, tanggal, jam_mulai, jam_selesai, pertemuan_ke, transmisi) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [siswa.id, finalInstrukturId, tanggal, jam_mulai, jam_selesai, pertemuan_ke, finalTransmisi]
        );

        // Kirim konfirmasi WA
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                let phone = no_telepon.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (!phone.startsWith('62')) phone = '62' + phone;

                const tglFormatted = new Date(tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    timeZone: 'Asia/Jakarta'
                });

                const message = `📅 *KONFIRMASI JADWAL LATIHAN*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${siswa.nama_lengkap}* 👋

Jadwal latihan Anda telah berhasil dibuat:

📆 Tanggal: *${tglFormatted}*
⏰ Jam: *${jam_mulai} - ${jam_selesai}*
🔢 Pertemuan Ke-${pertemuan_ke}${finalTransmisi ? `\n⚙️ Transmisi: *${finalTransmisi}*` : ''}

⚠️ Mohon hadir 10 menit sebelum jadwal.

💵 Jangan lupa untuk kasih uang tip instruktur minimal Rp 20.000

Terima kasih 🙏
_PSJ Driving Course_`;

                await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: phone, message, typing: false })
                });

                // Kirim notifikasi WA ke instruktur jika dipilih
                if (instrukturIdValue) {
                    try {
                        const [instrRows] = await db.query('SELECT nama, no_telepon FROM instruktur WHERE id = ? AND is_active = 1', [instrukturIdValue]);
                        if (instrRows.length > 0 && instrRows[0].no_telepon) {
                            let instrPhone = instrRows[0].no_telepon.replace(/[^0-9]/g, '');
                            if (instrPhone.startsWith('0')) instrPhone = '62' + instrPhone.substring(1);
                            if (!instrPhone.startsWith('62')) instrPhone = '62' + instrPhone;

                            const instrMessage = `📅 *JADWAL LATIHAN BARU*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${instrRows[0].nama}* 👋

Anda mendapat jadwal latihan baru:

👤 Siswa: *${siswa.nama_lengkap}*
📦 Paket: *${paketRows.length > 0 ? paketRows[0].nama_paket : '-'}*
📆 Tanggal: *${tglFormatted}*
⏰ Jam: *${jam_mulai} - ${jam_selesai}*
🔢 Pertemuan Ke-${pertemuan_ke}${finalTransmisi ? `\n⚙️ Transmisi: *${finalTransmisi}*` : ''}
📍 Alamat Siswa: *${siswa.alamat || '-'}*

Terima kasih 🙏
_PSJ Driving Course_`;

                            await fetch('https://api.fonnte.com/send', {
                                method: 'POST',
                                headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ target: instrPhone, message: instrMessage, typing: false })
                            });
                            console.log(`✅ Notifikasi WA instruktur terkirim ke ${instrRows[0].nama}`);
                        }
                    } catch (instrErr) {
                        console.error('WA instruktur error (non-fatal):', instrErr.message);
                    }
                }
            }
        } catch (waErr) {
            console.error('WA jadwal error (non-fatal):', waErr.message);
        }

        res.json({
            success: true,
            message: `Jadwal latihan pertemuan ke-${pertemuan_ke} berhasil dibuat!`,
            data: { id: result.insertId, tanggal, jam_mulai, jam_selesai, pertemuan_ke }
        });
    } catch (error) {
        console.error('Siswa request jadwal error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUBLIC: Siswa batalkan jadwal
router.post('/siswa-cancel', async (req, res) => {
    try {
        const { jadwal_id, no_telepon } = req.body;
        if (!jadwal_id || !no_telepon) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        const phone = no_telepon.replace(/[^0-9]/g, '').trim();
        // Verify jadwal belongs to this siswa
        const [rows] = await db.query(
            `SELECT j.id, j.tanggal, j.jam_mulai, j.jam_selesai, j.pertemuan_ke, j.transmisi, j.instruktur_id, 
                    s.nama_lengkap, s.alamat,
                    (SELECT COUNT(*) FROM absensi WHERE jadwal_id = j.id) as is_absen 
             FROM jadwal j 
             JOIN siswa s ON j.siswa_id = s.id 
             WHERE j.id = ? AND (
                REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?
             )`,
            [jadwal_id, phone, phone.replace(/^0+/, '')]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
        }

        if (rows[0].is_absen > 0) {
            return res.status(400).json({ success: false, message: 'Jadwal yang sudah diabsen oleh admin tidak dapat dibatalkan' });
        }

        // Check if jadwal is in the past
        const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const today = nowJakarta.getFullYear() + '-' + String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + String(nowJakarta.getDate()).padStart(2, '0');
        if (rows[0].tanggal < today) {
            return res.status(400).json({ success: false, message: 'Tidak dapat membatalkan jadwal yang sudah lewat' });
        }

        // Delete absensi first, then jadwal
        await db.query('DELETE FROM absensi WHERE jadwal_id = ?', [jadwal_id]);
        await db.query('DELETE FROM jadwal WHERE id = ?', [jadwal_id]);

        // Kirim notifikasi WA ke siswa & instruktur bahwa jadwal dibatalkan (cancel)
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                const tglFormatted = new Date(rows[0].tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                });

                // 1. Kirim ke Siswa
                let studentPhone = phone;
                if (studentPhone.startsWith('0')) studentPhone = '62' + studentPhone.substring(1);
                if (!studentPhone.startsWith('62')) studentPhone = '62' + studentPhone;

                const studentMessage = `❌ *PEMBATALAN JADWAL LATIHAN (CANCEL)*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${rows[0].nama_lengkap}* 👋

Jadwal latihan Anda telah berhasil dibatalkan (cancel):

🔢 Pertemuan Ke-${rows[0].pertemuan_ke}
⚙️ Transmisi: *${rows[0].transmisi || '-'}*

🗓️ *Jadwal yang Dibatalkan:*
- Tanggal: *${tglFormatted}*
- Jam: *${rows[0].jam_mulai.slice(0, 5)} - ${rows[0].jam_selesai.slice(0, 5)}*

Terima kasih 🙏
_PSJ Driving Course_`;

                await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: studentPhone, message: studentMessage, typing: false })
                });

                // 2. Kirim ke Instruktur jika dipilih
                if (rows[0].instruktur_id) {
                    const [instrRows] = await db.query('SELECT nama, no_telepon FROM instruktur WHERE id = ? AND is_active = 1', [rows[0].instruktur_id]);
                    if (instrRows.length > 0 && instrRows[0].no_telepon) {
                        let instrPhone = instrRows[0].no_telepon.replace(/[^0-9]/g, '');
                        if (instrPhone.startsWith('0')) instrPhone = '62' + instrPhone.substring(1);
                        if (!instrPhone.startsWith('62')) instrPhone = '62' + instrPhone;

                        const message = `❌ *PEMBATALAN JADWAL LATIHAN (CANCEL)*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${instrRows[0].nama}* 👋

Jadwal latihan siswa Anda telah dibatalkan (cancel):

👤 Siswa: *${rows[0].nama_lengkap}*
🔢 Pertemuan Ke-${rows[0].pertemuan_ke}
⚙️ Transmisi: *${rows[0].transmisi || '-'}*
📍 Alamat Siswa: *${rows[0].alamat || '-'}*

🗓️ *Jadwal yang Dibatalkan:*
- Tanggal: *${tglFormatted}*
- Jam: *${rows[0].jam_mulai.slice(0, 5)} - ${rows[0].jam_selesai.slice(0, 5)}*

Terima kasih 🙏
_PSJ Driving Course_`;

                        await fetch('https://api.fonnte.com/send', {
                            method: 'POST',
                            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target: instrPhone, message, typing: false })
                        });
                    }
                }
            }
        } catch (err) {
            console.error('WA cancel error (non-fatal):', err.message);
        }

        res.json({ success: true, message: 'Jadwal berhasil dibatalkan' });
    } catch (error) {
        console.error('Siswa cancel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUBLIC: Siswa reschedule jadwal
router.post('/siswa-reschedule', async (req, res) => {
    try {
        const { jadwal_id, no_telepon, tanggal_baru, jam_mulai_baru } = req.body;
        if (!jadwal_id || !no_telepon || !tanggal_baru || !jam_mulai_baru) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        const phone = no_telepon.replace(/[^0-9]/g, '').trim();
        // Verify jadwal belongs to this siswa
        const [rows] = await db.query(
            `SELECT j.id, j.tanggal, j.jam_mulai, j.jam_selesai, j.pertemuan_ke, j.transmisi, j.instruktur_id, j.siswa_id, 
                    s.nama_lengkap, s.alamat,
                    (SELECT COUNT(*) FROM absensi WHERE jadwal_id = j.id) as is_absen 
             FROM jadwal j 
             JOIN siswa s ON j.siswa_id = s.id 
             WHERE j.id = ? AND (
                REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?
             )`,
            [jadwal_id, phone, phone.replace(/^0+/, '')]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
        }

        if (rows[0].is_absen > 0) {
            return res.status(400).json({ success: false, message: 'Jadwal yang sudah diabsen oleh admin tidak dapat di-reschedule' });
        }

        const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const today = nowJakarta.getFullYear() + '-' + String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + String(nowJakarta.getDate()).padStart(2, '0');
        if (rows[0].tanggal < today) {
            return res.status(400).json({ success: false, message: 'Tidak dapat reschedule jadwal yang sudah lewat' });
        }

        if (tanggal_baru < today) {
            return res.status(400).json({ success: false, message: 'Tidak bisa reschedule ke tanggal yang sudah lewat' });
        }

        // Hitung durasi berdasarkan paket siswa
        const [paketRows] = await db.query(
            `SELECT pk.nama_paket FROM siswa s 
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
             WHERE s.id = ?`,
            [rows[0].siswa_id]
        );
        let durasi = 60;
        if (paketRows.length > 0 && paketRows[0].nama_paket) {
            const namaPaket = paketRows[0].nama_paket.toLowerCase();
            if (namaPaket.includes('matic') || namaPaket.includes('private')) {
                durasi = 120;
            }
        }

        const [hours, minutes] = jam_mulai_baru.split(':').map(Number);
        const endDate = new Date(2000, 0, 1, hours, minutes + durasi);
        const jam_selesai_baru = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

        // Cek konflik instruktur (exclude jadwal ini sendiri)
        const instId = rows[0].instruktur_id;
        if (instId) {
            const [conflicts] = await db.query(
                `SELECT COUNT(*) as cnt FROM jadwal 
                 WHERE tanggal = ? AND instruktur_id = ? AND id != ? AND (
                     jam_mulai < ? AND jam_selesai > ?
                 )`,
                [tanggal_baru, instId, jadwal_id, jam_selesai_baru, jam_mulai_baru]
            );

            if (conflicts[0].cnt >= 1) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Instruktur Anda sudah memiliki jadwal mengajar di rentang jam tersebut. Silakan pilih waktu lain.' 
                });
            }
        }

        // Cek siswa sudah punya jadwal di tanggal baru (exclude jadwal ini)
        const [existing] = await db.query(
            'SELECT COUNT(*) as cnt FROM jadwal WHERE siswa_id = ? AND tanggal = ? AND id != ?',
            [rows[0].siswa_id, tanggal_baru, jadwal_id]
        );

        if (existing[0].cnt > 0) {
            return res.status(400).json({ success: false, message: 'Anda sudah punya jadwal di tanggal tersebut. Pilih tanggal lain.' });
        }

        // Update jadwal
        await db.query(
            'UPDATE jadwal SET tanggal = ?, jam_mulai = ?, jam_selesai = ? WHERE id = ?',
            [tanggal_baru, jam_mulai_baru, jam_selesai_baru, jadwal_id]
        );

        // Hapus absensi lama
        await db.query('DELETE FROM absensi WHERE jadwal_id = ?', [jadwal_id]);

        // Kirim notifikasi WA ke siswa & instruktur bahwa jadwal di-reschedule
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                const tglLamaFormatted = new Date(rows[0].tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                });
                const tglBaruFormatted = new Date(tanggal_baru).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                });

                // 1. Kirim ke Siswa
                let studentPhone = phone;
                if (studentPhone.startsWith('0')) studentPhone = '62' + studentPhone.substring(1);
                if (!studentPhone.startsWith('62')) studentPhone = '62' + studentPhone;

                const studentMessage = `🔄 *PERUBAHAN JADWAL LATIHAN (RESCHEDULE)*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${rows[0].nama_lengkap}* 👋

Jadwal latihan Anda telah berhasil di-reschedule:

🔢 Pertemuan Ke-${rows[0].pertemuan_ke}
⚙️ Transmisi: *${rows[0].transmisi || '-'}*

🗓️ *Jadwal LAMA:*
- Tanggal: *${tglLamaFormatted}*
- Jam: *${rows[0].jam_mulai.slice(0, 5)} - ${rows[0].jam_selesai.slice(0, 5)}*

🗓️ *Jadwal BARU:*
- Tanggal: *${tglBaruFormatted}*
- Jam: *${jam_mulai_baru} - ${jam_selesai_baru}*

⚠️ Mohon hadir 10 menit sebelum jadwal baru.

💵 Jangan lupa untuk kasih uang tip instruktur minimal Rp 20.000

Terima kasih 🙏
_PSJ Driving Course_`;

                await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: studentPhone, message: studentMessage, typing: false })
                });

                // 2. Kirim ke Instruktur jika dipilih
                if (rows[0].instruktur_id) {
                    const [instrRows] = await db.query('SELECT nama, no_telepon FROM instruktur WHERE id = ? AND is_active = 1', [rows[0].instruktur_id]);
                    if (instrRows.length > 0 && instrRows[0].no_telepon) {
                        let instrPhone = instrRows[0].no_telepon.replace(/[^0-9]/g, '');
                        if (instrPhone.startsWith('0')) instrPhone = '62' + instrPhone.substring(1);
                        if (!instrPhone.startsWith('62')) instrPhone = '62' + instrPhone;

                        const message = `🔄 *PERUBAHAN JADWAL LATIHAN (RESCHEDULE)*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${instrRows[0].nama}* 👋

Siswa Anda melakukan reschedule jadwal latihan:

👤 Siswa: *${rows[0].nama_lengkap}*
🔢 Pertemuan Ke-${rows[0].pertemuan_ke}
⚙️ Transmisi: *${rows[0].transmisi || '-'}*
📍 Alamat Siswa: *${rows[0].alamat || '-'}*

🗓️ *Jadwal LAMA:*
- Tanggal: *${tglLamaFormatted}*
- Jam: *${rows[0].jam_mulai.slice(0, 5)} - ${rows[0].jam_selesai.slice(0, 5)}*

🗓️ *Jadwal BARU:*
- Tanggal: *${tglBaruFormatted}*
- Jam: *${jam_mulai_baru} - ${jam_selesai_baru}*

Mohon sesuaikan jadwal Anda. Terima kasih 🙏
_PSJ Driving Course_`;

                        await fetch('https://api.fonnte.com/send', {
                            method: 'POST',
                            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target: instrPhone, message, typing: false })
                        });
                    }
                }
            }
        } catch (err) {
            console.error('WA reschedule error (non-fatal):', err.message);
        }

        res.json({ success: true, message: 'Jadwal berhasil di-reschedule!' });
    } catch (error) {
        console.error('Siswa reschedule error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

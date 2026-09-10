const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('./auth');

// Sanitize input: encode HTML entities to prevent XSS (allowing slashes for addresses)
function sanitize(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
}

// Master Whitelist Paket Kursus
const paketMap = {
    'manual-10': 'Manual - 10x Pertemuan',
    'manual-8': 'Manual - 8x Pertemuan',
    'manual-6': 'Manual - 6x Pertemuan',
    'matic-5': 'Matic - 5x Pertemuan',
    'matic-4': 'Matic - 4x Pertemuan',
    'matic-3': 'Matic - 3x Pertemuan',
    'kombinasi-5': 'Kombinasi - 5x Pertemuan',
    'kombinasi-7': 'Kombinasi - 7x Pertemuan',
    'manual-10-sim': 'Manual 10x + SIM',
    'manual-8-sim': 'Manual 8x + SIM',
    'matic-5-sim': 'Matic 5x + SIM',
    'matic-4-sim': 'Matic 4x + SIM',
    'matic-3-sim': 'Matic 3x + SIM',
    'kombinasi-5-sim': 'Kombinasi 5x + SIM',
    'kombinasi-7-sim': 'Kombinasi 7x + SIM',
    'private-1': 'Private - Per Pertemuan'
};

// Master Harga Paket (angka)
const hargaMapNum = {
    'manual-10': 1200000,
    'manual-8': 1000000,
    'manual-6': 800000,
    'matic-5': 1500000,
    'matic-4': 1300000,
    'matic-3': 1000000,
    'kombinasi-5': 1500000,
    'kombinasi-7': 2000000,
    'manual-10-sim': 1800000,
    'manual-8-sim': 1600000,
    'matic-5-sim': 2100000,
    'matic-4-sim': 1900000,
    'matic-3-sim': 1600000,
    'kombinasi-5-sim': 2100000,
    'kombinasi-7-sim': 2600000,
    'private-1': 350000
};

router.post('/daftar', async (req, res) => {
    try {
        const rawNama = (req.body.nama_lengkap || '').trim();
        const rawPhone = (req.body.no_telepon || '').trim();
        const paket_id = (req.body.paket_id || '').trim();
        const tipe_layanan = req.body.tipe_layanan || 'outlet';

        if (!rawNama || !rawPhone || !paket_id) {
            return res.status(400).json({ success: false, message: 'Nama, No. WhatsApp, dan Paket Kursus wajib diisi.' });
        }

        // Validasi Nama Lengkap: hanya boleh huruf, spasi, titik, koma, kutip, strip
        const nameRegex = /^[a-zA-Z\s\.\,\'\`\-]+$/;
        if (!nameRegex.test(rawNama) || rawNama.length < 3 || rawNama.length > 100 || /\b(OR|AND|SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b/i.test(rawNama)) {
            return res.status(400).json({ success: false, message: 'Nama Lengkap tidak valid (hanya huruf dan spasi, 3-100 karakter).' });
        }
        const nama_lengkap = sanitize(rawNama);

        // Validasi tipe_layanan: hanya boleh 'outlet' atau 'penjemputan'
        const allowedTipeLayanan = ['outlet', 'penjemputan'];
        if (!allowedTipeLayanan.includes(tipe_layanan)) {
            return res.status(400).json({ success: false, message: 'Tipe layanan tidak valid.' });
        }

        let alamat = 'Datang ke Outlet';
        if (tipe_layanan === 'penjemputan') {
            const rawAlamat = (req.body.alamat || '').trim();
            if (!rawAlamat || rawAlamat.length < 5) {
                return res.status(400).json({ success: false, message: 'Alamat penjemputan lengkap wajib diisi (minimal 5 karakter).' });
            }
            if (rawAlamat.length > 500) {
                return res.status(400).json({ success: false, message: 'Alamat terlalu panjang (maks 500 karakter).' });
            }
            const suspiciousPattern = /('|"|--|;|<|>|OR\s+\d|AND\s+\d|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|SCRIPT)/i;
            if (suspiciousPattern.test(rawAlamat)) {
                return res.status(400).json({ success: false, message: 'Alamat mengandung karakter yang tidak diizinkan.' });
            }
            alamat = sanitize(rawAlamat);
        }

        const no_telepon = sanitize(rawPhone);

        // Validasi Nomor WhatsApp: hanya boleh angka, spasi, strip, tambah
        const phoneRegex = /^[0-9\+\-\s\(\)]+$/;
        if (!phoneRegex.test(no_telepon)) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp hanya boleh berisi angka.' });
        }

        const phoneClean = no_telepon.replace(/[^0-9]/g, '').trim();
        if (phoneClean.length < 8 || phoneClean.length > 15) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid (harus 8-15 digit angka).' });
        }


        // Cek duplikat: no_telepon saja
        const [dupRows] = await db.query(
            `SELECT id FROM siswa 
             WHERE REPLACE(REPLACE(no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(no_telepon, ' ', ''), '-', '') = ?`,
            [phoneClean, phoneClean.replace(/^0+/, '')]
        );

        if (dupRows.length > 0) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp ini sudah terdaftar sebelumnya.' });
        }

        // VALIDASI KRITIS: paket_id HARUS ada di whitelist, tolak semua input lainnya
        if (!paket_id || !paketMap[paket_id]) {
            return res.status(400).json({ success: false, message: 'Paket kursus tidak valid. Silakan pilih paket yang tersedia.' });
        }

        const isPenjemputan = tipe_layanan === 'penjemputan';
        const baseHargaNum = hargaMapNum[paket_id] || 0;
        const pickupFee = isPenjemputan ? 150000 : 0;
        const totalHargaNum = baseHargaNum + pickupFee;
        const paketHarga = totalHargaNum > 0 ? `Rp ${totalHargaNum.toLocaleString('id-ID')}` : '-';
        const baseHargaFormatted = baseHargaNum > 0 ? `Rp ${baseHargaNum.toLocaleString('id-ID')}` : '-';

        // Cari paket_kursus di DB
        let dbPaketId = null;
        let paketNama = paketMap[paket_id];

        const [rows] = await db.query('SELECT id FROM paket_kursus WHERE nama_paket = ?', [paketNama]);
        if (rows.length > 0) {
            dbPaketId = rows[0].id;
        } else {
            const [fallbackRows] = await db.query('SELECT id FROM paket_kursus WHERE nama_paket LIKE ? LIMIT 1', [`%${paketNama}%`]);
            if (fallbackRows.length > 0) {
                dbPaketId = fallbackRows[0].id;
            }
        }
        // Generate nomor registrasi yang selalu naik (tidak reset saat data dihapus)
        const [maxReg] = await db.query('SELECT MAX(id) as maxId FROM siswa');
        const nextRegNum = (maxReg[0].maxId || 0) + 1;

        const [result] = await db.query(
            'INSERT INTO siswa (id, nama_lengkap, no_telepon, alamat, paket_id, status, status_pembayaran, pertemuan_sebelumnya) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nextRegNum, nama_lengkap, no_telepon, alamat, dbPaketId, 'pending', 'belum_lunas', 0]
        );

        const registerId = nextRegNum;

        // Kirim invoice WhatsApp ke pendaftar
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                let phone = no_telepon.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (!phone.startsWith('62')) phone = '62' + phone;

                const tanggal = new Date().toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    timeZone: 'Asia/Jakarta'
                });
                const jam = new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'Asia/Jakarta'
                });

                const invoiceMessage = `📋 *INVOICE PENDAFTARAN*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
Panca Sari Jaya
━━━━━━━━━━━━━━━━━━

No. Registrasi: *#REG-${String(registerId).padStart(4, '0')}*
Tanggal: ${tanggal}
Jam: ${jam}

👤 *Data Pendaftar*
Nama: ${nama_lengkap}
No. WhatsApp: ${no_telepon}
📍 Metode: ${alamat === 'Datang ke Outlet' ? 'Datang ke Outlet' : `Penjemputan (${alamat})`}

📦 *Detail Biaya*
Paket: ${paketNama} (${baseHargaFormatted})
${isPenjemputan ? 'Biaya Penjemputan: Rp 150.000\n' : ''}Total Pembayaran: *${paketHarga}*

━━━━━━━━━━━━━━━━━━
📍 Jl. Paku Jaya Permai No.12 Blok A15,
RT.003/RW.5, Paku Jaya,
Kec. Serpong Utara, Kota Tangerang,
Banten 15220

📞 +62 813-8535-9897
━━━━━━━━━━━━━━━━━━

✅ Pendaftaran Anda telah *berhasil* dicatat. Silakan atur jadwal latihan melalui website kami di menu *Jadwal*.

📎 *Sertakan bukti pembayaran* saat konfirmasi ke admin.

Terima kasih telah memilih *PSJ Driving Course*! 🚗`;

                const studentParams = new URLSearchParams();
                studentParams.append('target', phone);
                studentParams.append('message', invoiceMessage);

                const studentRes = await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: studentParams
                });
                const studentResult = await studentRes.json();
                console.log(`📱 Invoice WA result (${phone}):`, JSON.stringify(studentResult));

                // Kirim notifikasi ke admin
                const adminPhone = (process.env.ADMIN_PHONE && !process.env.ADMIN_PHONE.includes('x')) ? process.env.ADMIN_PHONE : '';
                if (adminPhone) {
                    const adminMessage = `🔔 *PENDAFTAR BARU!*
━━━━━━━━━━━━━━━━━━
📝 *Nama:* ${nama_lengkap}
📱 *No. WA:* ${no_telepon}
📍 *Metode:* ${isPenjemputan ? `Penjemputan (${alamat})` : 'Datang ke Outlet'}
📦 *Paket:* ${paketNama} (${baseHargaFormatted})
${isPenjemputan ? '🚗 *Biaya Penjemputan:* Rp 150.000\n' : ''}💰 *Total Pembayaran:* ${paketHarga}
🕐 *Waktu:* ${tanggal}, ${jam}
📋 *No. Registrasi:* REG-${String(registerId).padStart(4, '0')}
━━━━━━━━━━━━━━━━━━
⏳ Status: *Menunggu Pembayaran*

Silakan cek dashboard admin untuk konfirmasi setelah pembayaran diterima.`;

                    const adminParams = new URLSearchParams();
                    adminParams.append('target', adminPhone);
                    adminParams.append('message', adminMessage);

                    const adminRes = await fetch('https://api.fonnte.com/send', {
                        method: 'POST',
                        headers: { 'Authorization': token },
                        body: adminParams
                    });
                    const adminResult = await adminRes.json();
                    console.log(`📌 Admin WA result (${adminPhone}):`, JSON.stringify(adminResult));
                    if (adminResult.status) {
                        console.log(`✅ Notifikasi admin terkirim ke ${adminPhone}`);
                    } else {
                        console.log(`⚠️ Notifikasi admin gagal: ${adminResult.reason || 'unknown'}`);
                    }
                }
            }
        } catch (waError) {
            // Jangan gagalkan registrasi jika WA gagal kirim
            console.error('WA notification error (non-fatal):', waError.message);
        }

        res.json({ success: true, message: 'Pendaftaran berhasil! Invoice telah dikirim ke WhatsApp Anda.', id: registerId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Gagal mendaftar. Silakan coba lagi.' });
    }
});

// PUBLIC: Tambah Paket Baru untuk Siswa yang Sudah Ada (Tanpa Daftar Ulang)
router.post('/tambah-paket', async (req, res) => {
    try {
        let { no_telepon, paket_id, tipe_layanan, alamat } = req.body;
        if (!no_telepon || !paket_id) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan Paket Kursus wajib diisi.' });
        }

        const phoneClean = no_telepon.replace(/[^0-9]/g, '').trim();
        if (phoneClean.length < 8 || phoneClean.length > 15) {
            return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid.' });
        }

        // Whitelist validasi paket
        if (!paket_id || !paketMap[paket_id]) {
            return res.status(400).json({ success: false, message: 'Paket kursus tidak valid. Silakan pilih paket yang tersedia.' });
        }

        // Cari siswa berdasarkan no telepon
        const [siswaRows] = await db.query(
            `SELECT s.*, pk.nama_paket as paket_lama 
             FROM siswa s 
             LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
             WHERE REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ? 
                OR REPLACE(REPLACE(s.no_telepon, ' ', ''), '-', '') = ?`,
            [phoneClean, phoneClean.replace(/^0+/, '')]
        );

        if (siswaRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Siswa belum terdaftar. Silakan lakukan pendaftaran baru terlebih dahulu.' });
        }

        const siswa = siswaRows[0];

        // Validasi tipe layanan & alamat
        tipe_layanan = tipe_layanan || 'outlet';
        let finalAlamat = 'Datang ke Outlet';
        if (tipe_layanan === 'penjemputan') {
            const rawAlamat = (alamat || '').trim();
            if (!rawAlamat || rawAlamat.length < 5) {
                return res.status(400).json({ success: false, message: 'Alamat penjemputan wajib diisi (minimal 5 karakter).' });
            }
            const suspiciousPattern = /('|"|--|;|<|>|OR\s+\d|AND\s+\d|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|SCRIPT)/i;
            if (suspiciousPattern.test(rawAlamat)) {
                return res.status(400).json({ success: false, message: 'Alamat mengandung karakter yang tidak diizinkan.' });
            }
            finalAlamat = sanitize(rawAlamat);
        }

        // Cari ID paket baru di tabel paket_kursus
        const namaPaketBaru = paketMap[paket_id];
        let newPaketId = null;
        let newPaketJumlah = 5;
        const [paketDbRows] = await db.query('SELECT id, nama_paket, harga, jumlah_pertemuan FROM paket_kursus WHERE nama_paket = ?', [namaPaketBaru]);
        if (paketDbRows.length > 0) {
            newPaketId = paketDbRows[0].id;
            newPaketJumlah = paketDbRows[0].jumlah_pertemuan;
        } else {
            const [fallbackRows] = await db.query('SELECT id, nama_paket, harga, jumlah_pertemuan FROM paket_kursus WHERE nama_paket LIKE ? LIMIT 1', [`%${namaPaketBaru}%`]);
            if (fallbackRows.length > 0) {
                newPaketId = fallbackRows[0].id;
                newPaketJumlah = fallbackRows[0].jumlah_pertemuan;
            }
        }

        // Hitung total hadir saat ini (dijadikan pertemuan_sebelumnya agar kuota paket baru dihitung mulai dari 0)
        const [hadirRows] = await db.query(
            `SELECT COUNT(*) as total FROM absensi WHERE siswa_id = ? AND status = 'hadir'`,
            [siswa.id]
        );
        const totalHadirSekarang = hadirRows[0].total || 0;
        const offset = parseInt(siswa.pertemuan_sebelumnya) || 0;
        const totalHadirAktif = Math.max(0, totalHadirSekarang - offset);

        // Ambil kuota sesi paket aktif saat ini
        let totalSesiLama = 0;
        if (siswa.paket_id) {
            const [oldPkt] = await db.query('SELECT jumlah_pertemuan, nama_paket FROM paket_kursus WHERE id = ?', [siswa.paket_id]);
            if (oldPkt.length > 0) {
                totalSesiLama = oldPkt[0].jumlah_pertemuan || 0;
            }
        }
        if (!totalSesiLama && siswa.paket_lama) {
            const match = siswa.paket_lama.match(/(\d+)\s*x/i);
            if (match) totalSesiLama = parseInt(match[1]);
            else if (/private|per pertemuan/i.test(siswa.paket_lama)) totalSesiLama = 1;
        }

        // VALIDASI KRITIS: Tolak tambah paket jika sesi latihan paket saat ini belum selesai semua
        const isSelesaiSemua = (totalSesiLama > 0 && totalHadirAktif >= totalSesiLama) || (siswa.status === 'selesai');
        if (totalSesiLama > 0 && !isSelesaiSemua) {
            return res.status(400).json({
                success: false,
                message: `Anda belum dapat menambah atau memperpanjang paket baru karena sesi latihan saat ini belum selesai (${totalHadirAktif}/${totalSesiLama} sesi). Harap selesaikan seluruh sesi latihan terlebih dahulu.`
            });
        }

        // Catat riwayat paket
        let riwayat = [];
        try {
            if (siswa.riwayat_paket) {
                riwayat = JSON.parse(siswa.riwayat_paket);
            }
        } catch (e) { riwayat = []; }
        riwayat.push({
            paket: siswa.paket_lama || '-',
            tanggal_selesai: new Date().toISOString()
        });

        // Hitung harga
        const baseHargaNum = hargaMapNum[paket_id] || 0;
        const isPenjemputan = tipe_layanan === 'penjemputan';
        const pickupFee = isPenjemputan ? 150000 : 0;
        const totalHargaNum = baseHargaNum + pickupFee;
        const totalHargaFormatted = `Rp ${totalHargaNum.toLocaleString('id-ID')}`;
        const baseHargaFormatted = `Rp ${baseHargaNum.toLocaleString('id-ID')}`;

        // Update siswa: pasang paket baru, reset counter pertemuan baru, status_pembayaran = belum_lunas
        await db.query(
            `UPDATE siswa 
             SET paket_id = ?, 
                 alamat = ?, 
                 status = 'aktif', 
                 status_pembayaran = 'belum_lunas', 
                 pertemuan_sebelumnya = ?, 
                 riwayat_paket = ? 
             WHERE id = ?`,
            [newPaketId, finalAlamat, totalHadirSekarang, JSON.stringify(riwayat), siswa.id]
        );

        // Kirim WhatsApp Invoice Tambah Paket (jika token aktif)
        try {
            const token = (process.env.FONNTE_TOKEN && process.env.FONNTE_TOKEN !== 'YOUR_FONNTE_TOKEN_HERE') ? process.env.FONNTE_TOKEN : '';
            if (token) {
                let phone = siswa.no_telepon.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (!phone.startsWith('62')) phone = '62' + phone;

                const invoiceMsg = `📋 *INVOICE PENAMBAHAN PAKET*
━━━━━━━━━━━━━━━━━━
🏫 *PSJ Driving Course*
━━━━━━━━━━━━━━━━━━

Halo *${siswa.nama_lengkap}* 👋
Penambahan paket latihan Anda berhasil dicatat!

📦 *Paket Baru:* ${namaPaketBaru} (${baseHargaFormatted})
🔢 *Jumlah Pertemuan:* ${newPaketJumlah}x Pertemuan
📍 *Metode:* ${isPenjemputan ? `Penjemputan (${finalAlamat})` : 'Datang ke Outlet'}
${isPenjemputan ? '🚗 *Biaya Penjemputan:* Rp 150.000\n' : ''}💰 *Total Pembayaran:* *${totalHargaFormatted}*

Silakan bayar via QRIS dan konfirmasi ke admin. Anda sudah bisa langsung mengatur jadwal latihan berikutnya di web!

Terima kasih 🙏
_PSJ Driving Course_`;

                const sp = new URLSearchParams();
                sp.append('target', phone);
                sp.append('message', invoiceMsg);
                fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: sp
                }).catch(() => {});
            }
        } catch (e) {}

        res.json({
            success: true,
            message: 'Paket latihan berhasil ditambahkan!',
            data: {
                siswa_id: siswa.id,
                nama_lengkap: siswa.nama_lengkap,
                no_telepon: siswa.no_telepon,
                paket_id: paket_id,
                nama_paket: namaPaketBaru,
                jumlah_pertemuan: newPaketJumlah,
                total_harga: totalHargaNum,
                total_harga_formatted: totalHargaFormatted,
                tipe_layanan: tipe_layanan,
                alamat: finalAlamat
            }
        });
    } catch (error) {
        console.error('Tambah paket error:', error);
        res.status(500).json({ success: false, message: 'Gagal menambah paket. Silakan coba lagi.' });
    }
});

// ADMIN: Get all siswa
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, pk.nama_paket, pk.jumlah_pertemuan,
                   (SELECT COUNT(*) FROM absensi a WHERE a.siswa_id = s.id AND a.status = 'hadir') as total_hadir
            FROM siswa s 
            LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
            ORDER BY s.tanggal_daftar DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get siswa error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ADMIN: Get single siswa
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, pk.nama_paket 
            FROM siswa s 
            LEFT JOIN paket_kursus pk ON s.paket_id = pk.id 
            WHERE s.id = ?
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Get siswa error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ADMIN: Update status & data siswa
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { status, status_pembayaran, paket_id, catatan, pertemuan_sebelumnya } = req.body;

        const allowedStatuses = ['pending', 'aktif', 'nonaktif', 'selesai'];
        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid' });
        }

        const allowedPembayaran = ['lunas', 'belum_lunas'];
        if (status_pembayaran && !allowedPembayaran.includes(status_pembayaran)) {
            return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid' });
        }

        const fields = [];
        const values = [];

        if (status !== undefined) {
            fields.push('status = ?');
            values.push(status);
        }
        if (status_pembayaran !== undefined) {
            fields.push('status_pembayaran = ?');
            values.push(status_pembayaran);
        }
        if (paket_id !== undefined) {
            fields.push('paket_id = ?');
            values.push(paket_id);
        }
        if (pertemuan_sebelumnya !== undefined) {
            fields.push('pertemuan_sebelumnya = ?');
            values.push(parseInt(pertemuan_sebelumnya) || 0);
        }
        if (catatan !== undefined) {
            fields.push('catatan = ?');
            values.push(catatan ? sanitize(catatan) : null);
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada data yang diupdate' });
        }

        values.push(req.params.id);
        await db.query(`UPDATE siswa SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ success: true, message: 'Data siswa berhasil diperbarui' });
    } catch (error) {
        console.error('Update siswa error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ADMIN: Toggle status pembayaran siswa (1-Klik Lunas / Belum Lunas)
router.put('/:id/toggle-pembayaran', isAuthenticated, async (req, res) => {
    try {
        const [siswaRows] = await db.query('SELECT id, nama_lengkap, status_pembayaran FROM siswa WHERE id = ?', [req.params.id]);
        if (siswaRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
        }
        const currentStatus = siswaRows[0].status_pembayaran || 'belum_lunas';
        const newStatus = currentStatus === 'lunas' ? 'belum_lunas' : 'lunas';
        await db.query('UPDATE siswa SET status_pembayaran = ? WHERE id = ?', [newStatus, req.params.id]);
        res.json({ 
            success: true, 
            status_pembayaran: newStatus,
            message: `Status pembayaran ${siswaRows[0].nama_lengkap} diubah menjadi: ${newStatus === 'lunas' ? 'LUNAS' : 'BELUM LUNAS'}` 
        });
    } catch (error) {
        console.error('Toggle pembayaran error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ADMIN: Delete siswa
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        // Hapus data terkait terlebih dahulu (foreign key)
        await db.query('DELETE FROM absensi WHERE siswa_id = ?', [req.params.id]);
        await db.query('DELETE FROM jadwal WHERE siswa_id = ?', [req.params.id]);
        await db.query('DELETE FROM siswa WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Data siswa berhasil dihapus' });
    } catch (error) {
        console.error('Delete siswa error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus siswa' });
    }
});

module.exports = router;

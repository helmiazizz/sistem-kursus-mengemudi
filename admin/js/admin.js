let allSiswa = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboard();
});

// ============================================
// AUTH CHECK
// ============================================
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (!data.success) {
            window.location.href = '/admin';
            return;
        }
        document.getElementById('adminName').textContent = data.admin.nama_lengkap;
        document.getElementById('adminAvatar').textContent = data.admin.nama_lengkap.charAt(0).toUpperCase();
    } catch (e) {
        window.location.href = '/admin';
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin';
}

// ============================================
// SIDEBAR & TABS
// ============================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function switchTab(tabName, element) {
    event.preventDefault();

    // Remove active from all
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    // Activate selected
    if (element) element.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update titles
    const titles = {
        dashboard: ['Dashboard', 'Selamat datang di panel admin'],
        siswa: ['Data Siswa', 'Kelola data pendaftar kursus'],
        'jadwal-booking': ['Jadwal Booking', 'Lihat jadwal yang di-booking siswa'],
        pengingat: ['Pengingat WA', 'Kirim pengingat jadwal via WhatsApp'],
        instruktur: ['Instruktur', 'Kelola data instruktur mengemudi'],
        armada: ['Armada Mobil', 'Kelola ketersediaan armada kendaraan latihan']
    };
    document.getElementById('pageTitle').textContent = titles[tabName][0];
    document.getElementById('pageSubtitle').textContent = titles[tabName][1];

    // Load data
    switch (tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'siswa': loadSiswa(); break;
        case 'jadwal-booking': initJadwalBooking(); break;
        case 'pengingat': loadPengingat(); break;
        case 'instruktur': loadInstruktur(); break;
        case 'armada': loadArmada(); break;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const { data } = await res.json();

        // === STATS CARDS ===
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon primary"><i class="fas fa-users"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.total_siswa}</div>
                    <div class="stat-label">Total Siswa</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><i class="fas fa-user-check"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.siswa_aktif}</div>
                    <div class="stat-label">Siswa Aktif</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><i class="fas fa-clock"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.siswa_pending || 0}</div>
                    <div class="stat-label">Menunggu Bayar</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon accent"><i class="fas fa-calendar-day"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.jadwal_hari_ini}</div>
                    <div class="stat-label">Jadwal Hari Ini</div>
                </div>
            </div>
        `;

        // === JADWAL HARI INI (compact card list) ===
        const schedulePanel = document.getElementById('todaySchedulePanel');
        if (data.today_schedule.length === 0) {
            schedulePanel.innerHTML = `
                <div style="text-align:center;padding:24px;color:var(--admin-text-muted);">
                    <i class="fas fa-calendar-check" style="font-size:2rem;display:block;margin-bottom:8px;opacity:0.5;"></i>
                    <p>Tidak ada jadwal hari ini</p>
                </div>`;
        } else {
            let todayAbsensi = {};
            try {
                const today = new Date().toISOString().split('T')[0];
                const abRes = await fetch('/api/absensi?tanggal=' + today);
                const abJson = await abRes.json();
                (abJson.data || []).forEach(a => { todayAbsensi[a.jadwal_id] = a; });
            } catch (e) { }

            schedulePanel.innerHTML = data.today_schedule.map(j => {
                const ab = todayAbsensi[j.id];
                const isQr = ab && ab.catatan && ab.catatan.includes('QR Code');
                const statusClass = ab ? (ab.status === 'hadir' ? 'aktif' : 'dibatalkan') : 'pending';
                const statusText = ab ? (ab.status === 'hadir' ? (isQr ? 'Hadir (QR)' : 'Hadir') : ab.status) : 'Menunggu';
                return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--admin-border);">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="width:36px;height:36px;border-radius:50%;background:var(--admin-primary-light);color:var(--admin-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;">K${j.pertemuan_ke || '-'}</div>
                            <div>
                                <div style="font-weight:600;font-size:0.85rem;">${escapeHtml(j.nama_lengkap)}</div>
                                <div style="font-size:0.75rem;color:var(--admin-text-muted);">${j.jam_mulai?.slice(0, 5)} - ${j.jam_selesai?.slice(0, 5)}</div>
                            </div>
                        </div>
                        <span class="badge badge-${statusClass}">${isQr && ab.status === 'hadir' ? '<i class="fas fa-qrcode"></i> ' : ''}${statusText}</span>
                    </div>`;
            }).join('');
        }

        // === PENDAFTARAN TERBARU ===
        const recentPanel = document.getElementById('recentRegistrationPanel');
        try {
            const siswaRes = await fetch('/api/siswa');
            const siswaJson = await siswaRes.json();
            const recent = (siswaJson.data || []).slice(0, 5);

            if (recent.length === 0) {
                recentPanel.innerHTML = `
                    <div style="text-align:center;padding:24px;color:var(--admin-text-muted);">
                        <i class="fas fa-user-plus" style="font-size:2rem;display:block;margin-bottom:8px;opacity:0.5;"></i>
                        <p>Belum ada pendaftaran</p>
                    </div>`;
            } else {
                recentPanel.innerHTML = recent.map(s => {
                    const statusClass = s.status === 'aktif' ? 'aktif' : (s.status === 'selesai' ? 'selesai' : 'pending');
                    const tgl = s.tanggal_daftar ? new Date(s.tanggal_daftar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    return `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--admin-border);">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;">${escapeHtml((s.nama_lengkap || 'S').charAt(0).toUpperCase())}</div>
                                <div>
                                    <div style="font-weight:600;font-size:0.85rem;">${escapeHtml(s.nama_lengkap)}</div>
                                    <div style="font-size:0.75rem;color:var(--admin-text-muted);">${s.nama_paket || '-'} · ${tgl}</div>
                                </div>
                            </div>
                            <span class="badge badge-${statusClass}">${s.status}</span>
                        </div>`;
                }).join('');
            }
        } catch (e) {
            recentPanel.innerHTML = '<p style="color:var(--admin-text-muted);text-align:center;">Gagal memuat data</p>';
        }

        // === PERLU PERHATIAN ===
        const attentionPanel = document.getElementById('attentionPanel');
        const alerts = [];

        // Siswa pending
        const pendingCount = data.siswa_pending || 0;
        if (pendingCount > 0) {
            alerts.push(`
                <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff3e0;border-radius:10px;border-left:4px solid #ff9800;">
                    <i class="fas fa-hourglass-half" style="color:#e65100;font-size:1.2rem;"></i>
                    <div>
                        <div style="font-weight:600;font-size:0.85rem;color:#e65100;">${pendingCount} Siswa Belum Bayar</div>
                        <div style="font-size:0.75rem;color:#bf360c;">Konfirmasi pembayaran di tab Data Siswa</div>
                    </div>
                </div>`);
        }

        // Jadwal besok
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const jadwalRes = await fetch('/api/jadwal?tanggal=' + tomorrowStr);
            const jadwalJson = await jadwalRes.json();
            const jadwalBesok = (jadwalJson.data || []).length;
            if (jadwalBesok > 0) {
                alerts.push(`
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#e3f2fd;border-radius:10px;border-left:4px solid #1976d2;">
                        <i class="fas fa-calendar-alt" style="color:#1565c0;font-size:1.2rem;"></i>
                        <div>
                            <div style="font-weight:600;font-size:0.85rem;color:#1565c0;">${jadwalBesok} Jadwal Besok</div>
                            <div style="font-size:0.75rem;color:#0d47a1;">Pastikan sudah kirim pengingat WA</div>
                        </div>
                    </div>`);
            }
        } catch (e) { }

        if (alerts.length === 0) {
            alerts.push(`
                <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#e8f5e9;border-radius:10px;border-left:4px solid #4caf50;">
                    <i class="fas fa-check-circle" style="color:#2e7d32;font-size:1.2rem;"></i>
                    <div>
                        <div style="font-weight:600;font-size:0.85rem;color:#2e7d32;">Semua Baik! ✨</div>
                        <div style="font-size:0.75rem;color:#1b5e20;">Tidak ada hal yang perlu perhatian saat ini</div>
                    </div>
                </div>`);
        }

        attentionPanel.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">${alerts.join('')}</div>`;

    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ============================================
// SISWA
// ============================================
async function loadSiswa() {
    try {
        const res = await fetch('/api/siswa');
        const { data } = await res.json();
        allSiswa = data || [];
        const tbody = document.getElementById('siswaTable');

        // Fetch absensi data to count pertemuan per siswa
        let absensiData = [];
        try {
            const absensiRes = await fetch('/api/absensi');
            const absensiJson = await absensiRes.json();
            absensiData = absensiJson.data || [];
        } catch (e) { }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fas fa-users"></i><h4>Belum ada data siswa</h4></td></tr>';
            return;
        }

        tbody.innerHTML = data.map((s, i) => {
            const hadirAll = s.total_hadir !== undefined ? s.total_hadir : absensiData.filter(a => a.siswa_id === s.id && a.status === 'hadir').length;
            const offset = parseInt(s.pertemuan_sebelumnya) || 0;
            const hadir = Math.max(0, hadirAll - offset);
            const paketMatch = (s.nama_paket || '').match(/(\d+)x/i);
            const totalPaket = s.jumlah_pertemuan || (paketMatch ? parseInt(paketMatch[1]) : 0);
            const isComplete = totalPaket > 0 && hadir >= totalPaket;
            const badgeColor = isComplete ? 'background:#e8f5e9;color:#2e7d32;' : '';
            const pertemuanText = totalPaket ? `${hadir}/${totalPaket}` : `${hadir}`;

            // Auto-update status to 'selesai' if training is complete, or back to 'aktif' if incomplete
            const displayStatus = isComplete ? 'selesai' : (s.status === 'selesai' ? 'aktif' : s.status);
            if (isComplete && s.status !== 'selesai') {
                // Fire and forget - update status to selesai
                fetch(`/api/siswa/${s.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'selesai' })
                }).catch(() => { });
            } else if (!isComplete && s.status === 'selesai') {
                // Fire and forget - update status back to aktif
                fetch(`/api/siswa/${s.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'aktif' })
                }).catch(() => { });
            }

            // Status badge with selesai support
            const statusBadgeMap = {
                'selesai': '<span class="badge" style="background:#d4edda;color:#155724;"><i class="fas fa-graduation-cap"></i> Selesai</span>',
                'aktif': '<span class="badge badge-aktif">aktif</span>',
                'pending': '<span class="badge badge-pending">pending</span>',
                'nonaktif': '<span class="badge badge-nonaktif">nonaktif</span>'
            };

            // Status pembayaran badge (Klik untuk toggle)
            const isLunas = (s.status_pembayaran === 'lunas');
            const bayarBadge = isLunas 
                ? `<span class="badge" style="background:#d4edda;color:#155724;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px;" onclick="togglePembayaran(${s.id})" title="Klik untuk ubah jadi Belum Lunas"><i class="fas fa-check-circle"></i> Lunas</span>`
                : `<span class="badge" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px;" onclick="togglePembayaran(${s.id})" title="Klik untuk ubah jadi Lunas"><i class="fas fa-exclamation-circle"></i> Belum Lunas</span>`;

            const formatAlamat = (!s.alamat || s.alamat === 'Datang ke Outlet') 
                ? '<span class="badge" style="background:#e3f2fd;color:#1565c0;font-weight:600;"><i class="fas fa-store"></i> Outlet</span>' 
                : `<span title="${escapeHtml(s.alamat)}"><i class="fas fa-car-side" style="color:#f57c00;margin-right:4px;"></i>${escapeHtml(s.alamat)}</span>`;

             return `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(s.nama_lengkap)}</strong></td>
                <td>${escapeHtml(s.no_telepon)}</td>
                <td>${formatAlamat}</td>
                <td>${escapeHtml(s.nama_paket || '-')}</td>
                <td><span class="pertemuan-badge" style="${badgeColor}"><i class="fas fa-check-circle"></i> ${pertemuanText} hadir</span></td>
                <td>${formatDate(s.tanggal_daftar)}</td>
                <td>${statusBadgeMap[displayStatus] || `<span class="badge badge-${displayStatus}">${displayStatus}</span>`}</td>
                <td>${bayarBadge}</td>
                <td><div style="display:flex;align-items:center;gap:6px;">
                    ${displayStatus === 'pending' ? `<button class="action-btn" style="background:#e8f5e9;color:#2e7d32;" onclick="konfirmasiPembayaran(${s.id})" title="Konfirmasi Aktif & Lunas">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    <button class="action-btn" style="${isLunas ? 'background:#fff8e1;color:#f57c00;' : 'background:#e8f5e9;color:#2e7d32;'}" onclick="togglePembayaran(${s.id})" title="${isLunas ? 'Tandai Belum Lunas' : 'Tandai Lunas'}">
                        <i class="fas ${isLunas ? 'fa-wallet' : 'fa-money-bill-wave'}"></i>
                    </button>
                    <button class="action-btn view" onclick="kelolaSiswa(${s.id}, '${(s.nama_lengkap || '').replace(/'/g, "\\'")}')" title="Kelola Jadwal & Paket">
                        <i class="fas fa-calendar-alt"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteSiswa(${s.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div></td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('Load siswa error:', error);
    }
}

// ============================================
// KONFIRMASI PEMBAYARAN & TOGGLE BAYAR
// ============================================
async function konfirmasiPembayaran(siswaId) {
    try {
        const res = await fetch(`/api/siswa/${siswaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'aktif', status_pembayaran: 'lunas' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Siswa dikonfirmasi aktif & lunas', 'success');
            loadSiswa();
            loadDashboard();
        } else {
            showToast(data.message || 'Gagal konfirmasi', 'error');
        }
    } catch (error) {
        showToast('Gagal mengkonfirmasi', 'error');
    }
}

async function togglePembayaran(siswaId) {
    try {
        const res = await fetch(`/api/siswa/${siswaId}/toggle-pembayaran`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadSiswa();
            loadDashboard();
        } else {
            showToast(data.message || 'Gagal mengubah status pembayaran', 'error');
        }
    } catch (error) {
        showToast('Gagal mengubah status pembayaran', 'error');
    }
}

// ============================================
// KELOLA SISWA (Jadwal + Absensi in one modal)
// ============================================
async function kelolaSiswa(siswaId, namaSiswa) {
    document.getElementById('kelolaTitle').textContent = `Kelola - ${namaSiswa}`;

    // Populate student details
    const detailsDiv = document.getElementById('kelolaDetails');
    const s = allSiswa.find(item => item.id === parseInt(siswaId));
    if (s && detailsDiv) {
        const alamatDetail = (!s.alamat || s.alamat === 'Datang ke Outlet')
            ? '<span style="color:#1565c0;font-weight:600;"><i class="fas fa-store"></i> Datang ke Outlet</span>'
            : `<span><i class="fas fa-car-side" style="color:#f57c00;margin-right:4px;"></i>${escapeHtml(s.alamat)}</span>`;

        let riwayatText = '';
        if (s.riwayat_paket) {
            try {
                const rp = JSON.parse(s.riwayat_paket);
                if (rp.length > 0) {
                    riwayatText = `<strong>Paket Sebelumnya:</strong> <span>${rp.map(r => escapeHtml(r.paket)).join(', ')}</span>`;
                }
            } catch (e) {}
        }

        const isLunas = (s.status_pembayaran === 'lunas');
        const bayarHtml = isLunas
            ? `<span class="badge" style="background:#d4edda;color:#155724;font-weight:600;"><i class="fas fa-check-circle"></i> Lunas</span>`
            : `<span class="badge" style="background:#fff3cd;color:#856404;font-weight:600;"><i class="fas fa-clock"></i> Belum Lunas</span>`;

        detailsDiv.style.display = 'block';
        detailsDiv.innerHTML = `
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 12px;align-items:center;">
                <strong>No. WhatsApp:</strong> <span>${escapeHtml(s.no_telepon)}</span>
                <strong>Paket Kursus:</strong> <span><strong>${escapeHtml(s.nama_paket || '-')}</strong></span>
                ${riwayatText}
                <strong>Status Pembayaran:</strong> <span>${bayarHtml}</span>
                <strong>Metode / Alamat:</strong> ${alamatDetail}
            </div>
        `;
    } else if (detailsDiv) {
        detailsDiv.style.display = 'none';
    }

    // Load riwayat jadwal + absensi
    await loadKelolaRiwayat(siswaId);

    document.getElementById('modalKelola').classList.add('active');
}

async function loadKelolaRiwayat(siswaId) {
    const riwayatDiv = document.getElementById('kelolaRiwayat');

    try {
        // Fetch jadwal for this siswa
        const jadwalRes = await fetch(`/api/jadwal?siswa_id=${siswaId}`);
        const jadwalJson = await jadwalRes.json();
        let rawJadwal = (jadwalJson.data || []).filter(j => j.siswa_id === parseInt(siswaId));

        // Deduplikasi defense-in-depth by ID
        const seenIds = new Set();
        const jadwalSiswa = rawJadwal.filter(j => {
            if (seenIds.has(j.id)) return false;
            seenIds.add(j.id);
            return true;
        });

        // Urutkan dari pertemuan 1 sampai terakhir
        jadwalSiswa.sort((a, b) => (a.pertemuan_ke - b.pertemuan_ke) || (new Date(a.tanggal) - new Date(b.tanggal)));

        // Fetch absensi for this siswa
        const absensiRes = await fetch(`/api/absensi?siswa_id=${siswaId}`);
        const absensiJson = await absensiRes.json();
        const absensiMap = {};
        (absensiJson.data || []).forEach(a => {
            absensiMap[a.jadwal_id] = a;
        });

        if (jadwalSiswa.length === 0) {
            riwayatDiv.innerHTML = '<p style="color:var(--admin-text-muted);text-align:center;padding:20px;"><i class="fas fa-info-circle"></i> Belum ada jadwal. Siswa perlu melakukan booking jadwal terlebih dahulu.</p>';
            return;
        }

        riwayatDiv.innerHTML = jadwalSiswa.map(j => {
            const absensi = absensiMap[j.id];
            const isQr = absensi && absensi.catatan && absensi.catatan.includes('QR Code');
            const hadirText = isQr ? '✅ Hadir (QR)' : '✅ Hadir';
            const statusBadge = absensi
                ? `<span class="badge badge-${absensi.status === 'hadir' ? 'aktif' : 'dibatalkan'}" style="font-size:0.8rem;padding:5px 12px;" title="${escapeHtml(absensi.catatan || '')}">${absensi.status === 'hadir' ? hadirText : '❌ Tidak Hadir'}</span>`
                : `<span class="badge badge-pending" style="font-size:0.8rem;padding:5px 12px;">⏳ Belum absen</span>`;

            return `
            <div style="border:1px solid var(--admin-border);border-radius:12px;margin-bottom:10px;background:#fafbfc;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;">
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:0.9rem;color:var(--admin-text);">
                            <i class="fas fa-calendar" style="color:var(--admin-primary);width:16px;"></i>
                            Pertemuan ${j.pertemuan_ke} — ${formatDate(j.tanggal)}
                        </div>
                        <div style="font-size:0.8rem;color:var(--admin-text-muted);margin-top:4px;">
                            <i class="fas fa-clock" style="width:16px;"></i> ${j.jam_mulai?.slice(0, 5)} - ${j.jam_selesai?.slice(0, 5)}
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${statusBadge}
                        <button class="action-btn delete" onclick="deleteJadwalKelola(${j.id}, ${siswaId})" title="Hapus" style="padding:6px 8px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${!absensi ? `
                <div style="display:flex;gap:8px;padding:0 16px 14px;border-top:1px solid var(--admin-border);padding-top:12px;">
                    <button onclick="markAbsensi(${j.id}, ${siswaId}, '${j.tanggal}', 'hadir')" style="flex:1;padding:10px;border:none;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;transition:all 0.2s;">
                        <i class="fas fa-check-circle"></i> Hadir
                    </button>
                    <button onclick="markAbsensi(${j.id}, ${siswaId}, '${j.tanggal}', 'tidak hadir')" style="flex:1;padding:10px;border:none;border-radius:8px;background:#fbe9e7;color:#c0392b;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;transition:all 0.2s;">
                        <i class="fas fa-times-circle"></i> Tidak Hadir
                    </button>
                </div>
                ` : ''}
            </div>`;
        }).join('');
    } catch (error) {
        riwayatDiv.innerHTML = '<p style="color:red;text-align:center;">Gagal memuat riwayat</p>';
    }
}

async function markAbsensi(jadwalId, siswaId, tanggal, status) {
    try {
        const res = await fetch('/api/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jadwal_id: jadwalId,
                siswa_id: siswaId,
                tanggal, status
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Absensi dicatat: ${status}`, 'success');
            await loadKelolaRiwayat(siswaId);
            loadSiswa();
            loadJadwalBooking();
            loadDashboard();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Gagal mencatat absensi', 'error');
    }
}

async function deleteJadwalKelola(jadwalId, siswaId) {
    showConfirm('Hapus Jadwal', 'Jadwal dan absensi terkait akan dihapus. Lanjutkan?', async () => {
        try {
            const res = await fetch(`/api/jadwal/${jadwalId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Jadwal dihapus', 'success');
                await loadKelolaRiwayat(siswaId);
                loadSiswa();
                loadJadwalBooking();
                loadDashboard();
            }
        } catch (error) {
            showToast('Gagal menghapus jadwal', 'error');
        }
    });
}


async function deleteSiswa(id) {
    showConfirm('Hapus Siswa', 'Data siswa beserta jadwal dan absensi terkait akan dihapus permanen. Lanjutkan?', async () => {
        try {
            const res = await fetch(`/api/siswa/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Siswa berhasil dihapus', 'success');
                loadSiswa();
            }
        } catch (error) {
            showToast('Gagal menghapus data', 'error');
        }
    });
}


// ============================================
// UTILITIES
// ============================================
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.4s ease reverse forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// SEARCH / FILTER TABLE
// ============================================
function filterTable(tableId, query) {
    const tbody = document.getElementById(tableId);
    const rows = tbody.querySelectorAll('tr');
    const q = query.toLowerCase().trim();

    if (!q) {
        rows.forEach(row => row.style.display = '');
        return;
    }

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

// ============================================
// WHATSAPP REMINDER
// ============================================
let pengingatData = [];

async function loadPengingat() {
    const dateInput = document.getElementById('waFilterDate');
    if (!dateInput.value) {
        // Default besok (untuk persiapan pengingat)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }

    try {
        // Load jadwal for selected date
        const res = await fetch('/api/jadwal');
        const { data } = await res.json();
        const filterDate = dateInput.value;

        // Show date label
        const dateObj = new Date(filterDate + 'T00:00:00');
        const today = new Date().toISOString().split('T')[0];
        const dateLabel = dateObj.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        document.getElementById('waDateLabel').innerHTML = `<i class="fas fa-calendar-day"></i> ${dateLabel}`;

        // Filter by date
        const remindedIds = JSON.parse(localStorage.getItem('remindedJadwal') || '[]');
        pengingatData = data.filter(j => {
            const jadwalDate = j.tanggal ? j.tanggal.slice(0, 10) : '';
            return jadwalDate === filterDate && !remindedIds.includes(j.id);
        });

        const tbody = document.getElementById('pengingatTable');

        if (pengingatData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
                <i class="fab fa-whatsapp" style="font-size:2rem;color:#25D366;"></i>
                <h4>Tidak ada jadwal untuk tanggal ini</h4>
                <p style="color:var(--admin-text-muted);">Pilih tanggal lain atau tambah jadwal terlebih dahulu</p>
            </td></tr>`;
        } else {
            tbody.innerHTML = pengingatData.map(j => {
                const phone = formatWaNumber(j.no_telepon || '');
                return `
                <tr>
                    <td><strong>${escapeHtml(j.nama_lengkap)}</strong></td>
                    <td>${escapeHtml(j.no_telepon || '-')}</td>
                    <td>${escapeHtml(j.alamat || '-')}</td>
                    <td>${formatDate(j.tanggal)}</td>
                    <td>${j.jam_mulai.slice(0, 5)} - ${j.jam_selesai.slice(0, 5)}</td>
                    <td>Ke-${j.pertemuan_ke}</td>
                    <td>
                        <button class="action-btn wa-btn" onclick="sendWaReminder(${j.id})" title="Kirim Pengingat WA" ${!phone ? 'disabled' : ''}>
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </td>
                </tr>
            `}).join('');
        }

    } catch (error) {
        console.error('Load pengingat error:', error);
    }
}

function setWaDateToday() {
    document.getElementById('waFilterDate').value = new Date().toISOString().split('T')[0];
    loadPengingat();
}

function setWaDateTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('waFilterDate').value = tomorrow.toISOString().split('T')[0];
    loadPengingat();
}


function formatWaNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
}

function getWaMessage(template, data = {}) {
    const nama = data.nama || '{nama}';
    const tanggal = data.tanggal || '{tanggal}';
    const jam = data.jam || '{jam}';
    const pertemuan = data.pertemuan || '{pertemuan}';
    const paket = data.paket || '{paket}';

    const templates = {
        reminder:
            `Halo *${nama}* 👋

Ini adalah pengingat dari *Panca Sari Jaya Driving Course* 🚗

📅 *Jadwal Latihan Anda:*
• Tanggal: *${tanggal}*
• Jam: *${jam}*
• Pertemuan: *Ke-${pertemuan}*

⚠️ Mohon hadir 10 menit sebelum jadwal. 😊

Jika ada kendala, silakan hubungi kami.

Terima kasih 🙏
_Panca Sari Jaya Driving Course_`,
    };
    return templates[template] || templates.reminder;
}

async function sendWaReminder(jadwalId) {
    const jadwal = pengingatData.find(j => j.id === jadwalId);
    if (!jadwal) {
        showToast('Data jadwal tidak ditemukan', 'error');
        return;
    }

    const phone = jadwal.no_telepon || '';
    if (!phone) {
        showToast('Nomor WhatsApp siswa tidak tersedia', 'error');
        return;
    }

    const message = getWaMessage('reminder', {
        nama: jadwal.nama_lengkap,
        tanggal: formatDate(jadwal.tanggal),
        jam: `${jadwal.jam_mulai.slice(0, 5)} - ${jadwal.jam_selesai.slice(0, 5)}`,
        pertemuan: jadwal.pertemuan_ke
    });

    try {
        showToast(`Mengirim pesan ke ${jadwal.nama_lengkap}...`, 'info');
        const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: phone, message })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Pesan terkirim ke ${jadwal.nama_lengkap}`, 'success');
            // Simpan ID yang sudah diingatkan ke localStorage
            const reminded = JSON.parse(localStorage.getItem('remindedJadwal') || '[]');
            reminded.push(jadwalId);
            localStorage.setItem('remindedJadwal', JSON.stringify(reminded));
            // Hapus dari list
            pengingatData = pengingatData.filter(j => j.id !== jadwalId);
            loadPengingat();
        } else {
            showToast(`❌ Gagal: ${data.message}`, 'error');
        }
    } catch (error) {
        showToast('Gagal mengirim pesan WhatsApp', 'error');
    }
}

// sendWaWelcome removed - invoice now sent automatically on registration

function sendAllReminders() {
    if (pengingatData.length === 0) {
        showToast('Tidak ada jadwal untuk dikirim pengingat', 'error');
        return;
    }

    const validJadwal = pengingatData.filter(j => j.no_telepon);
    if (validJadwal.length === 0) {
        showToast('Tidak ada siswa dengan nomor WhatsApp', 'error');
        return;
    }

    showConfirm('Kirim Pengingat', `Kirim pengingat ke ${validJadwal.length} siswa via WhatsApp?`, async () => {
        const messages = validJadwal.map(j => ({
            target: j.no_telepon,
            message: getWaMessage('reminder', {
                nama: j.nama_lengkap,
                tanggal: formatDate(j.tanggal),
                jam: `${j.jam_mulai.slice(0, 5)} - ${j.jam_selesai.slice(0, 5)}`,
                pertemuan: j.pertemuan_ke
            })
        }));

        try {
            showToast(`Mengirim ${messages.length} pesan...`, 'info');
            const res = await fetch('/api/whatsapp/send-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });
            const data = await res.json();
            if (data.success) {
                showToast(` ${data.message}`, 'success');
                // Simpan semua ID yang sudah diingatkan
                const reminded = JSON.parse(localStorage.getItem('remindedJadwal') || '[]');
                validJadwal.forEach(j => reminded.push(j.id));
                localStorage.setItem('remindedJadwal', JSON.stringify(reminded));
                pengingatData = [];
                loadPengingat();
            } else {
                showToast(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            showToast('Gagal mengirim pesan WhatsApp', 'error');
        }
    }, 'whatsapp');
}

// ============================================
// CUSTOM CONFIRM MODAL
// ============================================
let confirmCallback = null;

function showConfirm(title, message, callback, type = 'danger') {
    confirmCallback = callback;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;

    const icon = document.getElementById('confirmIcon');
    const btn = document.getElementById('confirmBtn');

    if (type === 'whatsapp') {
        icon.className = 'confirm-icon';
        icon.style.background = '#e8f5e9';
        icon.innerHTML = '<i class="fab fa-whatsapp" style="color:#25D366;"></i>';
        btn.className = 'btn btn-sm btn-whatsapp';
        btn.textContent = 'Kirim';
    } else {
        icon.className = 'confirm-icon danger';
        icon.style.background = '';
        icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        btn.className = 'btn btn-sm btn-danger';
        btn.textContent = 'Hapus';
    }

    document.getElementById('modalConfirm').classList.add('active');
}

function closeConfirm() {
    document.getElementById('modalConfirm').classList.remove('active');
    confirmCallback = null;
}

function executeConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirm();
}

// ============================================
// JADWAL BOOKING MANAGEMENT
// ============================================
function initJadwalBooking() {
    const dateInput = document.getElementById('bookingFilterDate');
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    loadJadwalBooking();
}

function setBookingDateToday() {
    document.getElementById('bookingFilterDate').value = new Date().toISOString().split('T')[0];
    loadJadwalBooking();
}

function setBookingDateTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('bookingFilterDate').value = tomorrow.toISOString().split('T')[0];
    loadJadwalBooking();
}

async function loadAllBookings() {
    document.getElementById('bookingFilterDate').value = '';
    try {
        const res = await fetch('/api/jadwal', { credentials: 'include' });
        const data = await res.json();
        
        let absensiMap = {};
        try {
            const abRes = await fetch('/api/absensi', { credentials: 'include' });
            const abJson = await abRes.json();
            (abJson.data || []).forEach(a => { absensiMap[a.jadwal_id] = a; });
        } catch (e) { }

        if (data.success) {
            renderBookingTable(data.data, 'Semua Jadwal', absensiMap);
        }
    } catch (error) {
        showToast('Gagal memuat jadwal', 'error');
    }
}

async function loadJadwalBooking() {
    const dateInput = document.getElementById('bookingFilterDate');
    const tanggal = dateInput.value;
    if (!tanggal) return;

    try {
        const res = await fetch(`/api/jadwal?tanggal=${tanggal}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            const dateObj = new Date(tanggal + 'T00:00:00');
            const dateLabel = dateObj.toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });

            // Fetch absensi for this date
            let absensiMap = {};
            try {
                const abRes = await fetch(`/api/absensi?tanggal=${tanggal}`);
                const abJson = await abRes.json();
                (abJson.data || []).forEach(a => { absensiMap[a.jadwal_id] = a; });
            } catch (e) { }

            renderBookingTable(data.data, dateLabel, absensiMap);
        }
    } catch (error) {
        showToast('Gagal memuat jadwal', 'error');
    }
}

function renderBookingTable(jadwalList, dateLabel, absensiMap = {}) {
    const tbody = document.getElementById('jadwalBookingTable');
    const summary = document.getElementById('bookingSummary');

    // Format time helper
    function fmtTime(t) {
        if (!t) return '-';
        return t.substring(0, 5);
    }

    // Summary cards based on absensi
    const total = jadwalList.length;
    const hadir = jadwalList.filter(j => (j.status_absensi || absensiMap[j.id]?.status) === 'hadir').length;
    const tidakHadir = jadwalList.filter(j => (j.status_absensi || absensiMap[j.id]?.status) === 'tidak hadir').length;
    const izin = jadwalList.filter(j => (j.status_absensi || absensiMap[j.id]?.status) === 'izin').length;
    const belumAbsen = total - hadir - tidakHadir - izin;

    summary.innerHTML = `
        <div class="booking-stat" style="background:#e3f2fd;">
            <div class="stat-number" style="color:#1565C0;">${total}</div>
            <div class="stat-label" style="color:#1565C0;">Total Jadwal</div>
        </div>
        <div class="booking-stat" style="background:#e8f5e9;">
            <div class="stat-number" style="color:#2e7d32;">${hadir}</div>
            <div class="stat-label" style="color:#2e7d32;">Hadir</div>
        </div>
        <div class="booking-stat" style="background:#fbe9e7;">
            <div class="stat-number" style="color:#c0392b;">${tidakHadir}</div>
            <div class="stat-label" style="color:#c0392b;">Tidak Hadir</div>
        </div>
        <div class="booking-stat" style="background:#fff3e0;">
            <div class="stat-number" style="color:#e65100;">${belumAbsen}</div>
            <div class="stat-label" style="color:#e65100;">Belum Absen</div>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;">
            <span style="font-size:0.9rem;color:var(--admin-text-muted);font-weight:600;"><i class="fas fa-calendar"></i> ${dateLabel}</span>
        </div>
    `;

    if (jadwalList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-calendar-times" style="font-size:1.5rem;opacity:0.3;"></i><h4>Tidak ada jadwal</h4><p>Belum ada booking pada tanggal ini</p></td></tr>';
        return;
    }

    tbody.innerHTML = jadwalList.map(j => {
        const tglClean = String(j.tanggal).split('T')[0];
        const parts = tglClean.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const tglStr = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const abStatus = j.status_absensi || absensiMap[j.id]?.status;
        const abCatatan = j.catatan_absensi || absensiMap[j.id]?.catatan || '';
        const isQr = abCatatan.includes('QR Code');

        let statusBadge;
        if (abStatus === 'hadir') {
            statusBadge = isQr
                ? '<span class="badge badge-aktif" title="Absensi Mandiri via QR Code"><i class="fas fa-qrcode"></i> Hadir (QR)</span>'
                : '<span class="badge badge-aktif"><i class="fas fa-check-circle"></i> Hadir</span>';
        } else if (abStatus === 'tidak hadir') {
            statusBadge = '<span class="badge badge-dibatalkan"><i class="fas fa-times-circle"></i> Tidak Hadir</span>';
        } else if (abStatus === 'izin') {
            statusBadge = '<span class="badge badge-pending" style="background:#e0f7fa;color:#006064;"><i class="fas fa-info-circle"></i> Izin</span>';
        } else {
            statusBadge = '<span class="badge badge-pending"><i class="fas fa-clock"></i> Belum Absen</span>';
        }

        const carDisplay = j.nama_kendaraan 
            ? `<span><i class="fas fa-car" style="color:var(--admin-primary-light);"></i> ${escapeHtml(j.nama_kendaraan)} ${j.nomor_polisi ? `<span style="font-size:0.75rem;color:var(--admin-text-muted);">(${escapeHtml(j.nomor_polisi)})</span>` : ''}</span>`
            : '<span style="color:var(--admin-text-muted);font-style:italic;">-</span>';

        return `
            <tr>
                <td><strong>${tglStr}</strong></td>
                <td>${fmtTime(j.jam_mulai)} - ${fmtTime(j.jam_selesai)}</td>
                <td><strong>${escapeHtml(j.nama_lengkap || '-')}</strong></td>
                <td>${escapeHtml(j.no_telepon || '-')}</td>
                <td>${escapeHtml(j.alamat || '-')}</td>
                <td><span class="pertemuan-pill">Ke-${j.pertemuan_ke || '-'}</span></td>
                <td><strong>${escapeHtml(j.transmisi || '-')}</strong></td>
                <td>${carDisplay}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// INSTRUKTUR MANAGEMENT
// ============================================
let allInstruktur = [];

async function loadInstruktur() {
    const tbody = document.getElementById('instrukturTable');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Memuat data instruktur...</td></tr>';
        const res = await fetch('/api/instruktur/all');
        const json = await res.json();

        if (!json.success || !json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada data instruktur</td></tr>';
            return;
        }

        allInstruktur = json.data;

        tbody.innerHTML = allInstruktur.map((inst, index) => {
            const isAktif = inst.is_active === 1 || inst.is_active === true;
            const statusBadge = isAktif
                ? `<span class="badge badge-aktif" style="cursor:pointer;" onclick="toggleInstruktur(${inst.id}, '${escapeHtml(inst.nama)}', 0)" title="Klik untuk liburkan"><i class="fas fa-check-circle"></i> Aktif</span>`
                : `<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;cursor:pointer;" onclick="toggleInstruktur(${inst.id}, '${escapeHtml(inst.nama)}', 1)" title="Klik untuk aktifkan"><i class="fas fa-bed"></i> Libur</span>`;

            const toggleBtn = isAktif
                ? `<button class="action-btn" style="background:#fff3e0;color:#e65100;" onclick="toggleInstruktur(${inst.id}, '${escapeHtml(inst.nama)}', 0)" title="Liburkan Instruktur"><i class="fas fa-bed"></i></button>`
                : `<button class="action-btn" style="background:#e8f5e9;color:#2e7d32;" onclick="toggleInstruktur(${inst.id}, '${escapeHtml(inst.nama)}', 1)" title="Aktifkan Instruktur"><i class="fas fa-check"></i></button>`;

            const phoneDisplay = inst.no_telepon
                ? `<a href="https://wa.me/${inst.no_telepon.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--admin-primary-light);text-decoration:none;"><i class="fab fa-whatsapp" style="color:#25D366;"></i> ${escapeHtml(inst.no_telepon)}</a>`
                : '<span style="color:var(--admin-text-muted);font-style:italic;">Belum diisi</span>';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(inst.nama)}</strong></td>
                    <td>${phoneDisplay}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${toggleBtn}
                            <button class="action-btn" style="background:#e3f2fd;color:#1565c0;" onclick="openEditInstruktur(${inst.id}, '${escapeHtml(inst.nama)}', '${escapeHtml(inst.no_telepon || '')}')" title="Edit Instruktur">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteInstruktur(${inst.id}, '${escapeHtml(inst.nama)}')" title="Hapus Instruktur">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load instruktur error:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:var(--admin-danger);">Gagal memuat data instruktur</td></tr>';
    }
}

function openAddInstruktur() {
    document.getElementById('instrukturEditId').value = '';
    document.getElementById('instrukturModalTitle').textContent = 'Tambah Instruktur';
    document.getElementById('instrukturNama').value = '';
    document.getElementById('instrukturPhone').value = '';
    document.getElementById('modalInstruktur').classList.add('active');
}

function openEditInstruktur(id, nama, phone) {
    document.getElementById('instrukturEditId').value = id;
    document.getElementById('instrukturModalTitle').textContent = 'Edit Instruktur';
    document.getElementById('instrukturNama').value = nama;
    document.getElementById('instrukturPhone').value = phone || '';
    document.getElementById('modalInstruktur').classList.add('active');
}

function closeInstrukturModal() {
    document.getElementById('modalInstruktur').classList.remove('active');
}

async function saveInstruktur() {
    const id = document.getElementById('instrukturEditId').value;
    const nama = document.getElementById('instrukturNama').value.trim();
    const phone = document.getElementById('instrukturPhone').value.trim();

    if (!nama) {
        showToast('Nama instruktur wajib diisi', 'error');
        return;
    }

    try {
        const url = id ? `/api/instruktur/${id}` : '/api/instruktur';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, no_telepon: phone || null })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message || 'Instruktur berhasil disimpan', 'success');
            closeInstrukturModal();
            loadInstruktur();
        } else {
            showToast(data.message || 'Gagal menyimpan instruktur', 'error');
        }
    } catch (error) {
        console.error('Save instruktur error:', error);
        showToast('Terjadi kesalahan koneksi server', 'error');
    }
}

async function toggleInstruktur(id, nama, targetStatus) {
    const actionLabel = targetStatus === 1 ? 'mengaktifkan' : 'meliburkan';
    try {
        const res = await fetch(`/api/instruktur/${id}/toggle`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || `Instruktur ${nama} berhasil diubah`, 'success');
            loadInstruktur();
        } else {
            showToast(data.message || `Gagal ${actionLabel} instruktur`, 'error');
        }
    } catch (error) {
        console.error('Toggle instruktur error:', error);
        showToast(`Gagal ${actionLabel} instruktur`, 'error');
    }
}

async function deleteInstruktur(id, nama) {
    showConfirm('Hapus Instruktur', `Yakin ingin menghapus instruktur "${nama}"? Jika instruktur sudah pernah mengajar, Anda dapat meliburkannya saja.`, async () => {
        try {
            const res = await fetch(`/api/instruktur/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Instruktur berhasil dihapus', 'success');
                loadInstruktur();
            } else {
                showToast(data.message || 'Gagal menghapus instruktur', 'error');
            }
        } catch (error) {
            console.error('Delete instruktur error:', error);
            showToast('Gagal menghapus instruktur', 'error');
        }
    });
}

// ============================================
// ARMADA MOBIL MANAGEMENT
// ============================================
let allArmada = [];

async function loadArmada() {
    const tbody = document.getElementById('armadaTable');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Memuat data armada...</td></tr>';
        const res = await fetch('/api/armada/all');
        const json = await res.json();

        if (!json.success || !json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data armada mobil</td></tr>';
            return;
        }

        allArmada = json.data;

        tbody.innerHTML = allArmada.map((a, index) => {
            const status = (a.status || 'tersedia').toLowerCase();
            let statusBadge = '';
            let nextActionBtn = '';

            if (status === 'tersedia') {
                statusBadge = `<span class="badge badge-aktif" style="cursor:pointer;" onclick="toggleStatusArmada(${a.id}, 'maintenance')" title="Klik untuk ubah jadi Maintenance"><i class="fas fa-check-circle"></i> Tersedia</span>`;
                nextActionBtn = `<button class="action-btn" style="background:#fff3e0;color:#e65100;" onclick="toggleStatusArmada(${a.id}, 'maintenance')" title="Tandai Masuk Bengkel / Maintenance"><i class="fas fa-tools"></i></button>`;
            } else if (status === 'maintenance') {
                statusBadge = `<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;cursor:pointer;" onclick="toggleStatusArmada(${a.id}, 'tersedia')" title="Klik untuk ubah jadi Tersedia"><i class="fas fa-wrench"></i> Maintenance</span>`;
                nextActionBtn = `<button class="action-btn" style="background:#e8f5e9;color:#2e7d32;" onclick="toggleStatusArmada(${a.id}, 'tersedia')" title="Tandai Selesai & Tersedia"><i class="fas fa-check"></i></button>`;
            } else {
                statusBadge = `<span class="badge badge-nonaktif" style="cursor:pointer;" onclick="toggleStatusArmada(${a.id}, 'tersedia')" title="Klik untuk ubah jadi Tersedia"><i class="fas fa-ban"></i> Tidak Aktif</span>`;
                nextActionBtn = `<button class="action-btn" style="background:#e8f5e9;color:#2e7d32;" onclick="toggleStatusArmada(${a.id}, 'tersedia')" title="Aktifkan Kembali"><i class="fas fa-check"></i></button>`;
            }

            const jenisPill = (a.jenis && a.jenis.toLowerCase() === 'matic')
                ? '<span class="badge" style="background:#f3e8ff;color:#7e22ce;font-weight:700;"><i class="fas fa-bolt"></i> Matic</span>'
                : '<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;"><i class="fas fa-cog"></i> Manual</span>';

            const tahunWarna = [a.tahun, a.warna].filter(Boolean).join(' · ') || '-';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(a.nama_kendaraan)}</strong>${a.catatan ? `<div style="font-size:0.75rem;color:var(--admin-text-muted);">${escapeHtml(a.catatan)}</div>` : ''}</td>
                    <td><span style="font-family:monospace;font-weight:700;padding:2px 8px;background:#f1f5f9;border-radius:4px;border:1px solid #cbd5e1;">${escapeHtml(a.nomor_polisi)}</span></td>
                    <td>${jenisPill}</td>
                    <td>${escapeHtml(tahunWarna)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${nextActionBtn}
                            <button class="action-btn" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;" onclick="openArmadaQr(${a.id}, '${escapeHtml(a.nama_kendaraan)}', '${escapeHtml(a.nomor_polisi)}')" title="Cetak QR Code Absensi Mobil">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button class="action-btn" style="background:#e3f2fd;color:#1565c0;" onclick="openEditArmada(${a.id})" title="Edit Armada">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteArmada(${a.id}, '${escapeHtml(a.nama_kendaraan)}')" title="Hapus Armada">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load armada error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color:var(--admin-danger);">Gagal memuat data armada</td></tr>';
    }
}

function openAddArmada() {
    document.getElementById('armadaEditId').value = '';
    document.getElementById('armadaModalTitle').textContent = 'Tambah Armada Mobil';
    document.getElementById('armadaNama').value = '';
    document.getElementById('armadaPlat').value = '';
    document.getElementById('armadaJenis').value = 'matic';
    document.getElementById('armadaStatus').value = 'tersedia';
    document.getElementById('armadaTahun').value = '';
    document.getElementById('armadaWarna').value = '';
    document.getElementById('armadaCatatan').value = '';
    document.getElementById('modalArmada').classList.add('active');
}

function openEditArmada(id) {
    const a = allArmada.find(item => item.id === id);
    if (!a) return;

    document.getElementById('armadaEditId').value = a.id;
    document.getElementById('armadaModalTitle').textContent = 'Edit Armada Mobil';
    document.getElementById('armadaNama').value = a.nama_kendaraan || '';
    document.getElementById('armadaPlat').value = a.nomor_polisi || '';
    document.getElementById('armadaJenis').value = (a.jenis || 'manual').toLowerCase();
    document.getElementById('armadaStatus').value = (a.status || 'tersedia').toLowerCase();
    document.getElementById('armadaTahun').value = a.tahun || '';
    document.getElementById('armadaWarna').value = a.warna || '';
    document.getElementById('armadaCatatan').value = a.catatan || '';
    document.getElementById('modalArmada').classList.add('active');
}

function closeArmadaModal() {
    document.getElementById('modalArmada').classList.remove('active');
}

async function saveArmada() {
    const id = document.getElementById('armadaEditId').value;
    const nama = document.getElementById('armadaNama').value.trim();
    const plat = document.getElementById('armadaPlat').value.trim();
    const jenis = document.getElementById('armadaJenis').value;
    const status = document.getElementById('armadaStatus').value;
    const tahun = document.getElementById('armadaTahun').value.trim();
    const warna = document.getElementById('armadaWarna').value.trim();
    const catatan = document.getElementById('armadaCatatan').value.trim();

    if (!nama || !plat) {
        showToast('Nama mobil dan plat nomor wajib diisi', 'error');
        return;
    }

    try {
        const url = id ? `/api/armada/${id}` : '/api/armada';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama_kendaraan: nama,
                nomor_polisi: plat,
                jenis,
                status,
                tahun: tahun ? parseInt(tahun) : null,
                warna: warna || null,
                catatan: catatan || null
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message || 'Armada berhasil disimpan', 'success');
            closeArmadaModal();
            loadArmada();
        } else {
            showToast(data.message || 'Gagal menyimpan armada', 'error');
        }
    } catch (error) {
        console.error('Save armada error:', error);
        showToast('Terjadi kesalahan koneksi server', 'error');
    }
}

async function toggleStatusArmada(id, targetStatus) {
    try {
        const res = await fetch(`/api/armada/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'Status armada berhasil diperbarui', 'success');
            loadArmada();
        } else {
            showToast(data.message || 'Gagal mengubah status armada', 'error');
        }
    } catch (error) {
        console.error('Toggle status armada error:', error);
        showToast('Gagal mengubah status armada', 'error');
    }
}

async function deleteArmada(id, nama) {
    showConfirm('Hapus Armada', `Yakin ingin menghapus armada "${nama}"? Jika armada sudah pernah digunakan pada jadwal latihan, silakan ubah statusnya menjadi Maintenance / Tidak Aktif.`, async () => {
        try {
            const res = await fetch(`/api/armada/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Armada berhasil dihapus', 'success');
                loadArmada();
            } else {
                showToast(data.message || 'Gagal menghapus armada', 'error');
            }
        } catch (error) {
            console.error('Delete armada error:', error);
            showToast('Gagal menghapus armada', 'error');
        }
    });
}

// ============================================
// QR CODE ABSENSI MANDIRI (ARMADA & OUTLET)
// ============================================
let qrCodeInstance = null;

function openArmadaQr(armadaId, namaMobil, noPolisi) {
    const origin = window.location.origin;
    const url = `${origin}/absen?armada=${encodeURIComponent(armadaId)}&plat=${encodeURIComponent(noPolisi)}`;

    document.getElementById('qrModalTitle').innerHTML = '<i class="fas fa-qrcode" style="color:var(--admin-primary);"></i> QR Code Absensi Mobil';
    document.getElementById('qrTargetName').textContent = namaMobil || 'Armada Mobil';
    document.getElementById('qrTargetSub').textContent = noPolisi || '';
    document.getElementById('qrUrlText').textContent = url;

    renderQrCode(url);
    document.getElementById('modalQrCode').classList.add('active');
}

function openOutletQrModal() {
    const origin = window.location.origin;
    const url = `${origin}/absen?outlet=1`;

    document.getElementById('qrModalTitle').innerHTML = '<i class="fas fa-qrcode" style="color:var(--admin-primary);"></i> QR Code Meja Outlet';
    document.getElementById('qrTargetName').textContent = 'Panca Sari Jaya Driving Course';
    document.getElementById('qrTargetSub').textContent = 'Standee / Meja Pendaftaran Outlet';
    document.getElementById('qrUrlText').textContent = url;

    renderQrCode(url);
    document.getElementById('modalQrCode').classList.add('active');
}

function renderQrCode(text) {
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        qrCodeInstance = new QRCode(container, {
            text: text,
            width: 170,
            height: 170,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        container.innerHTML = `<p style="font-size:0.8rem;color:red;padding:20px;">Library QR Code sedang dimuat...</p>`;
    }
}

function closeQrModal() {
    document.getElementById('modalQrCode').classList.remove('active');
}



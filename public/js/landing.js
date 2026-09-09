// ============================================
// Landing Page JavaScript
// Panca Sari Jaya - Kursus Mengemudi
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initScrollAnimations();
    initCounterAnimation();
    initRegistrationForm();
});

// ============================================
// NAVBAR
// ============================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const links = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active link tracking
        const sections = document.querySelectorAll('section[id]');
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        links.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Mobile toggle
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close on link click
    links.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
}

// ============================================
// SCROLL ANIMATIONS
// ============================================
function initScrollAnimations() {
    const elements = document.querySelectorAll('[data-animate]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => {
                    entry.target.classList.add('animated');
                }, parseInt(delay));
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    elements.forEach(el => observer.observe(el));
}

// ============================================
// COUNTER ANIMATION
// ============================================
function initCounterAnimation() {
    const counters = document.querySelectorAll('.stat-number[data-count]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.dataset.count);
    const duration = 2000;
    const start = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        element.textContent = Math.floor(target * eased);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}



// ============================================
// REGISTRATION FORM
// ============================================
function initRegistrationForm() {
    const form = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('submitBtn');
    const tipeLayananRadios = document.querySelectorAll('input[name="tipe_layanan"]');
    const alamatGroup = document.getElementById('alamatGroup');
    const alamatInput = document.getElementById('alamat');
    const namaInput = document.getElementById('nama_lengkap');
    const phoneInput = document.getElementById('no_telepon');

    // Real-time typing restriction: Nama hanya boleh huruf dan spasi
    if (namaInput) {
        ['input', 'paste'].forEach(evt => {
            namaInput.addEventListener(evt, () => {
                setTimeout(() => {
                    namaInput.value = namaInput.value.replace(/[^a-zA-Z\s\.\,\'\`\-]/g, '');
                }, 0);
            });
        });
    }

    // Real-time typing restriction: No WhatsApp hanya boleh angka
    if (phoneInput) {
        ['input', 'paste'].forEach(evt => {
            phoneInput.addEventListener(evt, () => {
                setTimeout(() => {
                    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
                }, 0);
            });
        });
    }

    if (tipeLayananRadios.length > 0) {
        tipeLayananRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.querySelectorAll('.metode-card').forEach(card => card.classList.remove('active'));
                const parentCard = e.target.closest('.metode-card');
                if (parentCard) parentCard.classList.add('active');

                if (e.target.value === 'penjemputan') {
                    if (alamatGroup) alamatGroup.style.display = 'block';
                    if (alamatInput) {
                        alamatInput.required = true;
                        alamatInput.focus();
                    }
                } else {
                    if (alamatGroup) alamatGroup.style.display = 'none';
                    if (alamatInput) {
                        alamatInput.required = false;
                        alamatInput.value = '';
                    }
                }
            });
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const nama = (data.nama_lengkap || '').trim();
        const phone = (data.no_telepon || '').trim();
        const tipeLayanan = data.tipe_layanan || 'outlet';

        // 1. Validasi Nama Lengkap: hanya huruf, spasi, titik, koma, kutip
        const nameRegex = /^[a-zA-Z\s\.\,\'\`\-]+$/;
        if (!nameRegex.test(nama)) {
            showToast('Nama Lengkap hanya boleh berisi huruf dan spasi.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
            return;
        }

        // 2. Validasi Nomor WhatsApp: hanya boleh angka
        const phoneRegex = /^[0-9\+\-\s\(\)]+$/;
        if (!phoneRegex.test(phone)) {
            showToast('Nomor WhatsApp hanya boleh berisi angka.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
            return;
        }

        const phoneClean = phone.replace(/[^0-9]/g, '');
        if (phoneClean.length < 8 || phoneClean.length > 15) {
            showToast('Nomor WhatsApp tidak valid (harus 8-15 digit angka).', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
            return;
        }

        // 3. Validasi Paket Kursus
        if (!data.paket_id) {
            showToast('Silakan pilih paket kursus.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
            return;
        }

        // 4. Validasi Alamat berdasarkan Tipe Layanan
        if (tipeLayanan === 'penjemputan') {
            const alamatText = (data.alamat || '').trim();
            if (!alamatText || alamatText.length < 5) {
                showToast('Alamat penjemputan lengkap wajib diisi (minimal 5 karakter).', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
                return;
            }
            data.alamat = alamatText;
        } else {
            data.alamat = 'Datang ke Outlet';
        }

        try {
            const response = await fetch('/api/siswa/daftar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                const phone = data.no_telepon;
                const siswaId = result.id;
                const paketId = data.paket_id;
                showPaymentModal(phone, siswaId, paketId, data.nama_lengkap, tipeLayanan);
                form.reset();
            } else {
                showToast(result.message || 'Gagal mendaftar. Silakan coba lagi.', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showToast('Terjadi kesalahan. Silakan coba lagi nanti.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
        }
    });
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ============================================
// MODAL
// ============================================

function showPaymentModal(phone, siswaId, paketId, nama, tipeLayanan = 'outlet') {
    const modal = document.getElementById('successModal');
    const content = modal.querySelector('.modal-content');

    const hargaMap = {
        'manual-10': { text: 'Rp 1.200.000', num: 1200000 },
        'manual-8': { text: 'Rp 1.000.000', num: 1000000 },
        'manual-6': { text: 'Rp 800.000', num: 800000 },
        'matic-5': { text: 'Rp 1.500.000', num: 1500000 },
        'matic-4': { text: 'Rp 1.300.000', num: 1300000 },
        'matic-3': { text: 'Rp 1.000.000', num: 1000000 },
        'kombinasi-5': { text: 'Rp 1.500.000', num: 1500000 },
        'kombinasi-7': { text: 'Rp 2.000.000', num: 2000000 },
        'manual-10-sim': { text: 'Rp 1.800.000', num: 1800000 },
        'manual-8-sim': { text: 'Rp 1.600.000', num: 1600000 },
        'matic-5-sim': { text: 'Rp 2.100.000', num: 2100000 },
        'matic-4-sim': { text: 'Rp 1.900.000', num: 1900000 },
        'matic-3-sim': { text: 'Rp 1.600.000', num: 1600000 },
        'kombinasi-5-sim': { text: 'Rp 2.100.000', num: 2100000 },
        'kombinasi-7-sim': { text: 'Rp 2.600.000', num: 2600000 },
        'private-1': { text: 'Rp 350.000', num: 350000 }
    };

    const paketNamaMap = {
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

    const harga = hargaMap[paketId] || { text: '-', num: 0 };
    const paketNama = paketNamaMap[paketId] || paketId;
    const isPenjemputan = tipeLayanan === 'penjemputan';
    const pickupFee = isPenjemputan ? 150000 : 0;
    const totalNum = harga.num + pickupFee;
    const totalText = totalNum > 0 ? `Rp ${totalNum.toLocaleString('id-ID')}` : '-';

    // Format WA confirmation message
    const waNumber = '6281385359897'; // Nomor admin PSJ
    const waMessage = encodeURIComponent(
        `Halo Admin Panca Sari Jaya,\n\nSaya sudah melakukan pendaftaran dan pembayaran via QRIS.\n\n` +
        `📋 *Detail Pendaftaran:*\n` +
        `Nama: ${nama}\n` +
        `No. WA: ${phone}\n` +
        `Paket: ${paketNama}\n` +
        `Metode: ${isPenjemputan ? 'Penjemputan ke Rumah (+Rp 150.000)' : 'Datang ke Outlet'}\n` +
        `Total Pembayaran: ${totalText}\n\n` +
        `Mohon konfirmasi pembayaran saya. Terima kasih 🙏`
    );

    content.innerHTML = `
        <h3 style="margin-bottom:4px;">Pendaftaran Berhasil! 🎉</h3>
        <p style="margin-bottom:10px;font-size:0.8rem;">Bayar via QRIS, lalu konfirmasi via WhatsApp.</p>
        
        <div style="background:#f0f7ff;border-radius:8px;padding:10px;margin-bottom:10px;border:1px solid #d0e3f7;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:0.75rem;color:#666;">Paket Kursus</span>
                <span style="font-size:0.8rem;font-weight:600;color:#333;">${paketNama}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:0.75rem;color:#666;">Metode Latihan</span>
                <span style="font-size:0.8rem;font-weight:600;color:${isPenjemputan ? '#f57c00' : '#1565C0'};">${isPenjemputan ? 'Penjemputan ke Rumah' : 'Datang ke Outlet'}</span>
            </div>
            ${isPenjemputan ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding-top:4px;border-top:1px dashed #c0d8f3;">
                <span style="font-size:0.75rem;color:#666;">Biaya Penjemputan</span>
                <span style="font-size:0.8rem;font-weight:600;color:#f57c00;">+ Rp 150.000</span>
            </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #c0d8f3;">
                <span style="font-size:0.75rem;font-weight:700;color:#333;">Total Pembayaran</span>
                <span style="font-size:1.05rem;font-weight:800;color:#1565C0;">${totalText}</span>
            </div>
        </div>

        <div style="background:#fafafa;border-radius:8px;padding:10px;text-align:center;border:1px solid #eee;margin-bottom:10px;">
            <img src="/images/qris-psj.webp?v=3" alt="QRIS Panca Sari Jaya" 
                 width="180" height="254"
                 style="max-width:180px;width:100%;height:auto;border-radius:4px;"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div style="display:none;flex-direction:column;align-items:center;gap:6px;padding:12px;">
                <i class="fas fa-qrcode" style="font-size:1.5rem;color:#ccc;"></i>
                <span style="font-size:0.7rem;color:#999;">QRIS belum tersedia</span>
            </div>
            <div style="font-size:0.65rem;color:#999;margin-top:4px;">
                <i class="fas fa-shield-alt"></i> Scan dengan e-wallet / m-banking
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
            <a href="https://api.whatsapp.com/send?phone=${waNumber}&text=${waMessage}" target="_blank" 
               style="text-decoration:none;text-align:center;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;font-size:0.8rem;border-radius:8px;font-weight:600;">
                <i class="fab fa-whatsapp"></i> Konfirmasi via WhatsApp
            </a>
            <a href="/jadwal.html?phone=${encodeURIComponent(phone)}" 
               style="background:#e3f2fd;color:#1565C0;text-decoration:none;text-align:center;padding:9px;font-size:0.8rem;border-radius:8px;font-weight:600;">
                <i class="fas fa-calendar-alt"></i> Atur Jadwal Latihan
            </a>
            <button style="background:transparent;color:#666;border:1.5px solid #ddd;cursor:pointer;padding:9px;font-size:0.8rem;border-radius:8px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.2s;" onmouseover="this.style.background='#f8f9fa';this.style.borderColor='#aaa';this.style.color='#333'" onmouseout="this.style.background='transparent';this.style.borderColor='#ddd';this.style.color='#666'" onclick="closeModal()"><i class="fas fa-times"></i> Tutup</button>
        </div>
    `;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('successModal').classList.remove('active');
}


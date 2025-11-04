const API_BASE = window.location.origin;

const formatVND = (n) => Number(n || 0).toLocaleString() + " VND";

// Load dashboard stats (default - all time)
async function loadDashboardStats() {
    try {
        const [bookingsRes, revenueRes, monthlyRes, guestsRes] = await Promise.all([
            fetch(`${API_BASE}/api/bookings/total`),
            fetch(`${API_BASE}/api/revenue/total`),
            fetch(`${API_BASE}/api/revenue/current-month`),
            fetch(`${API_BASE}/api/guests/new`),
        ]);

        const [bookings, revenue, monthly, guests] = await Promise.all([
            bookingsRes.json(),
            revenueRes.json(),
            monthlyRes.json(),
            guestsRes.json(),
        ]);

        console.log("📊 API Data:", { bookings, revenue, monthly, guests });

        document.getElementById("total-bookings").textContent = bookings.total ?? "--";
        document.getElementById("occupancy-rate").textContent = formatVND(revenue.total_revenue);
        document.getElementById("total-revenue").textContent = formatVND(monthly.monthly_revenue);
        document.getElementById("new-guests").textContent = guests.new_guests ?? "--";

        console.log("✅ Dashboard loaded successfully");
    } catch (err) {
        console.error("❌ Lỗi load dashboard:", err);
    }
}

// Load filtered stats by month/year
async function loadFilteredStats(month, year) {
    try {
        const [bookingsRes, revenueRes, totalRevenueRes] = await Promise.all([
            fetch(`${API_BASE}/api/bookings/filter?month=${month}&year=${year}`),
            fetch(`${API_BASE}/api/revenue/filter?month=${month}&year=${year}`),
            fetch(`${API_BASE}/api/revenue/total`) // Luôn lấy tổng doanh thu
        ]);

        const [bookings, revenue, totalRevenue] = await Promise.all([
            bookingsRes.json(),
            revenueRes.json(),
            totalRevenueRes.json()
        ]);

        // Update card màu xanh dương - Tổng booking theo tháng
        document.getElementById("total-bookings").textContent = bookings.total ?? "--";

        // Update card màu xanh lá - TỔNG doanh thu toàn hệ thống (không đổi)
        document.getElementById("occupancy-rate").textContent = formatVND(totalRevenue.total_revenue);

        // Update card màu cam - Doanh thu tháng được chọn
        document.getElementById("total-revenue").textContent = formatVND(revenue.total_revenue);

        console.log('✅ Filtered data loaded:', { month, year, bookings, revenue, totalRevenue });
    } catch (err) {
        console.error("❌ Error loading filtered stats:", err);
    }
}

// Apply filter
async function applyFilter() {
    const month = document.getElementById('monthFilter').value;
    const year = document.getElementById('yearFilter').value;

    if (month) {
        await loadFilteredStats(month, year);
        document.getElementById('revenue-title').textContent = `Doanh thu tháng ${month}`;
        document.getElementById('revenue-desc').textContent = `Doanh thu tháng ${month}/${year}`;
    } else {
        await loadDashboardStats();
        const currentMonth = new Date().getMonth() + 1;
        document.getElementById('revenue-title').textContent = `Doanh thu tháng ${currentMonth}`;
        document.getElementById('revenue-desc').textContent = 'Doanh thu tháng hiện tại';
    }
}

// Reset filter
async function resetFilter() {
    document.getElementById('monthFilter').value = '';
    document.getElementById('yearFilter').value = '2025';
    await loadDashboardStats();
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('revenue-title').textContent = `Doanh thu tháng ${currentMonth}`;
    document.getElementById('revenue-desc').textContent = 'Doanh thu tháng hiện tại';
}

// Load top rooms
async function loadTopRooms() {
    try {
        const res = await fetch(`${API_BASE}/api/rooms/top-booked?limit=5`);
        const rooms = await res.json();
        window.topRoomsData = rooms;

        const container = document.getElementById('topRoomsList');

        if (rooms.length === 0) {
            container.innerHTML = '<p style="color: #666;">Chưa có dữ liệu</p>';
            return;
        }

        container.innerHTML = rooms.map((room, index) => `
            <div class="room-item">
                <div class="room-info">
                    <div class="room-rank">${index + 1}</div>
                    <div class="room-details">
                        <h3>${room.category || 'N/A'}</h3>
                        <p>📍 ${room.location || 'N/A'}</p>
                    </div>
                </div>
                <div class="room-stats">
                    <p class="bookings">${room.booking_count}</p>
                    <p class="revenue">${formatVND(room.total_revenue)}</p>
                </div>
            </div>
        `).join('');

        console.log('✅ Loaded top 5 rooms:', rooms);
    } catch (err) {
        console.error('❌ Error loading top rooms:', err);
        document.getElementById('topRoomsList').innerHTML =
            '<p style="color: red;">Lỗi khi tải dữ liệu phòng</p>';
    }
}

// Export to PDF
async function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        // Title
        pdf.setFontSize(20);
        pdf.text('BAO CAO THONG KE RESORT', 105, 20, { align: 'center' });

        pdf.setFontSize(12);
        pdf.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, 105, 30, { align: 'center' });

        // Stats
        const totalBookings = document.getElementById('total-bookings').textContent;
        const totalRevenue = document.getElementById('occupancy-rate').textContent;
        const monthlyRevenue = document.getElementById('total-revenue').textContent;
        const newGuests = document.getElementById('new-guests').textContent;

        pdf.setFontSize(14);
        pdf.text('THONG KE TONG QUAN', 20, 45);

        pdf.setFontSize(11);
        let y = 55;
        pdf.text(`- Tong luot dat phong: ${totalBookings}`, 25, y);
        y += 10;
        pdf.text(`- Tong doanh thu: ${totalRevenue}`, 25, y);
        y += 10;
        pdf.text(`- Doanh thu thang hien tai: ${monthlyRevenue}`, 25, y);
        y += 10;
        pdf.text(`- Khach moi (30 ngay): ${newGuests}`, 25, y);

        // Capture chart
        const canvas = document.getElementById('revenueChart');
        const chartImg = canvas.toDataURL('image/png');

        y += 20;
        pdf.text('BIEU DO DOANH THU', 20, y);
        y += 5;
        pdf.addImage(chartImg, 'PNG', 20, y, 170, 80);

        // Top rooms
        y += 90;
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }

        pdf.text('TOP 5 PHONG DUOC DAT NHIEU NHAT', 20, y);
        y += 10;

        const topRooms = window.topRoomsData || [];
        topRooms.forEach((room, index) => {
            if (y > 270) {
                pdf.addPage();
                y = 20;
            }
            pdf.text(`${index + 1}. ${room.category} - ${room.location}`, 25, y);
            y += 7;
            pdf.text(`   So luot dat: ${room.booking_count} | Doanh thu: ${formatVND(room.total_revenue)}`, 25, y);
            y += 10;
        });

        pdf.save(`Bao-cao-thong-ke-${new Date().toISOString().slice(0, 10)}.pdf`);
        alert('✅ Da xuat bao cao PDF thanh cong!');
    } catch (err) {
        console.error('❌ Loi xuat PDF:', err);
        alert('❌ Loi khi xuat PDF: ' + err.message);
    }
}

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    // Không set default month, để trống = hiển thị tất cả
    document.getElementById('monthFilter').value = '';
    document.getElementById('yearFilter').value = '2025';

    // Load all data (không lọc)
    loadDashboardStats();
    loadTopRooms();

    // Set title mặc định
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('revenue-title').textContent = `Doanh thu tháng ${currentMonth}`;
    document.getElementById('revenue-desc').textContent = 'Doanh thu tháng hiện tại';
});

// Logout handler
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        if (confirm("Bạn có chắc muốn đăng xuất không?")) {
            localStorage.removeItem("token");
            alert("Đã đăng xuất!");
            window.location.href = "http://localhost:5500/login.html";
        }
    });
});
function handleLogout() {
    if (confirm("Bạn có chắc muốn đăng xuất không?")) {
        localStorage.removeItem("token");
        alert("Đã đăng xuất!");
        window.location.href = "http://localhost:5500/login.html";
    }
}

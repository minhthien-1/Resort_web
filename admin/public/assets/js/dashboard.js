const API_BASE = window.location.origin;

const formatVND = (n) => Number(n || 0).toLocaleString() + " VND";

async function loadDashboardStats() {
    try {
        const [bookingsRes, revenueRes, monthlyRes, guestsRes] = await Promise.all([
            fetch(`${API_BASE}/api/bookings/total`),
            fetch(`${API_BASE}/api/revenue/total`),           // Tổng doanh thu
            fetch(`${API_BASE}/api/revenue/current-month`),   // Doanh thu tháng 10
            fetch(`${API_BASE}/api/guests/new`),
        ]);

        const [bookings, revenue, monthly, guests] = await Promise.all([
            bookingsRes.json(),
            revenueRes.json(),
            monthlyRes.json(),
            guestsRes.json(),
        ]);

        // ✅ Debug
        console.log("📊 API Data:", {
            bookings,
            revenue,
            monthly,
            guests
        });

        // Ô 1 (xanh dương): Tổng lượt đặt phòng
        document.getElementById("total-bookings").textContent = bookings.total ?? "--";

        // Ô 2 (xanh lá): Tổng doanh thu toàn hệ thống
        document.getElementById("occupancy-rate").textContent = formatVND(revenue.total_revenue);

        // Ô 3 (cam): Doanh thu tháng 10
        document.getElementById("total-revenue").textContent = formatVND(monthly.monthly_revenue);

        // Ô 4 (tím): Khách mới trong 30 ngày
        document.getElementById("new-guests").textContent = guests.new_guests ?? "--";

        console.log("✅ Dashboard loaded successfully");
    } catch (err) {
        console.error("❌ Lỗi load dashboard:", err);
    }
}

window.addEventListener("DOMContentLoaded", loadDashboardStats);
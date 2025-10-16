// ==============================
// 📊 Revenue Chart (6 months)
// ==============================

async function loadRevenueChart() {
    try {
        // Gọi API backend để lấy dữ liệu doanh thu theo tháng
        const res = await fetch(`${window.location.origin}/api/revenue/monthly`);
        let data = await res.json();

        if (!data || data.length === 0) {
            console.warn("⚠️ Không có dữ liệu doanh thu!");
            return;
        }

        // ✅ Lấy 6 tháng gần nhất (nếu có nhiều hơn 6 tháng)
        data = data.slice(-6);

        // ✅ Chuyển 'YYYY-MM' → 'Tháng viết tắt'
        const labels = data.map(row => {
            const [year, month] = row.month.split("-");
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return monthNames[parseInt(month) - 1];
        });

        const values = data.map(row => Number(row.total_revenue));

        // Lấy context của canvas
        const ctx = document.getElementById("revenueChart").getContext("2d");

        // ✅ Tạo gradient (hiệu ứng bóng đẹp)
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, "rgba(54, 162, 235, 0.5)");  // xanh trên
        gradient.addColorStop(1, "rgba(153, 102, 255, 0.2)"); // tím dưới

        // ✅ Hủy chart cũ (nếu có) để tránh lỗi khi reload
        if (window.revenueChartInstance) {
            window.revenueChartInstance.destroy();
        }

        // ✅ Tạo biểu đồ
        window.revenueChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Doanh thu (VND)",
                        data: values,
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: "rgba(54, 162, 235, 1)",
                        borderWidth: 3,
                        pointBackgroundColor: "white",
                        pointBorderColor: "rgba(54, 162, 235, 1)",
                        tension: 0.35,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#333",
                        titleFont: { size: 13, weight: "bold" },
                        bodyFont: { size: 13 },
                        callbacks: {
                            label: ctx => `${ctx.parsed.y.toLocaleString()} VND`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: "#666", font: { size: 13 } },
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: 200000000, // ✅ Trục Y giới hạn đến 50 triệu
                        ticks: {
                            color: "#666",
                            font: { size: 13 },
                            stepSize: 50000000,
                            callback: val => val.toLocaleString(),
                        },
                        grid: { color: "rgba(0, 0, 0, 0.05)" },
                    },
                },
            }

        });

        console.log("✅ Biểu đồ doanh thu 6 tháng gần nhất:", { labels, values });
    } catch (err) {
        console.error("❌ Lỗi khi tải biểu đồ doanh thu:", err);
    }
}

// Gọi khi trang tải xong
document.addEventListener("DOMContentLoaded", loadRevenueChart);

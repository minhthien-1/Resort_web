let vouchers = [];
let currentEditId = null;
const API_URL = "http://localhost:5500/api/discounts";
const token = localStorage.getItem("token");

if (!token) {
    alert("Vui lòng đăng nhập!");
    window.location.href = "../public/login.html";
}

// Cập nhật hint khi đổi loại giảm giá
document.getElementById('discountType').addEventListener('change', function (e) {
    const hint = document.getElementById('discountHint');
    const valueInput = document.getElementById('discountValue');

    if (e.target.value === 'percentage') {
        hint.textContent = 'Nhập phần trăm giảm giá (0-100)';
        valueInput.max = 100;
        valueInput.placeholder = '20';
    } else {
        hint.textContent = 'Nhập số tiền giảm (VNĐ)';
        valueInput.removeAttribute('max');
        valueInput.placeholder = '100000';
    }
});

async function loadVouchers() {
    try {
        const res = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Không thể tải danh sách voucher");
        vouchers = await res.json();
         // 🔥 Thêm đây
        console.log("📥 Response từ API:", JSON.stringify(vouchers, null, 2));
        console.log("🔎 Voucher đầu tiên:", vouchers[0]);
        console.log("📝 Có field 'name' không?", vouchers[0]?.name);
        renderTable();
    } catch (err) {
        console.error(err);
        alert("Lỗi khi tải danh sách voucher!");
    }
}

function openAddModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Thêm Voucher Mới';
    document.getElementById('voucherModal').classList.add('active');
    resetForm();
}

function openEditModal(id) {
    currentEditId = id;
    const voucher = vouchers.find(v => v.id === id);
    if (voucher) {
        document.getElementById('modalTitle').textContent = 'Chỉnh Sửa Voucher';
        document.getElementById('voucherCode').value = voucher.code;
        document.getElementById('voucherName').value = voucher.name;
        document.getElementById('discountType').value = voucher.discount_type;
        document.getElementById('discountValue').value = voucher.value;
        document.getElementById('maxUses').value = voucher.usage_limit;
        document.getElementById('expiryDate').value = voucher.valid_until;
        document.getElementById('description').value = voucher.description || '';
        document.getElementById('status').value = voucher.status;
        document.getElementById('voucherModal').classList.add('active');
    }
}

function closeModal() {
    document.getElementById('voucherModal').classList.remove('active');
    resetForm();
    currentEditId = null;
}

function resetForm() {
    document.querySelector('form').reset();
}

async function saveVoucher(e) {
    e.preventDefault();

    const voucherData = {
        code: document.getElementById('voucherCode').value.trim(),
        name: document.getElementById('voucherName').value.trim(),
        description: document.getElementById('description').value.trim() || "Không có mô tả",
        discount_type: document.getElementById('discountType').value,
        value: parseFloat(document.getElementById('discountValue').value) || 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: document.getElementById('expiryDate').value,
        status: document.getElementById('status').value || "active",
        usage_limit: parseInt(document.getElementById('maxUses').value) || 0
    };

    console.log("📤 Dữ liệu gửi đi:", voucherData);

    const method = currentEditId ? "PUT" : "POST";
    const url = currentEditId ? `${API_URL}/${currentEditId}` : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(voucherData),
        });

        const result = await res.json();

        if (!res.ok) {
            console.error("❌ Lỗi từ server:", result);
            throw new Error(result.error || result.details || "Lỗi lưu voucher");
        }

        alert(currentEditId ? "Cập nhật thành công!" : "Thêm voucher thành công!");
        closeModal();
        await loadVouchers();
    } catch (err) {
        console.error("❌ Lỗi:", err);
        alert("Không thể lưu voucher: " + err.message);
    }
}

async function deleteVoucher(id) {
    if (!confirm("Bạn có chắc muốn xóa voucher này?")) return;

    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Lỗi xóa voucher");
        alert("Đã xóa voucher thành công!");
        await loadVouchers();
    } catch (err) {
        console.error(err);
        alert("Không thể xóa voucher!");
    }
}

function renderTable() {
    const tbody = document.querySelector("#voucherTableBody");
    tbody.innerHTML = "";

    if (!vouchers || vouchers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#999;">Không có voucher nào</td></tr>`;
        return;
    }

    vouchers.forEach((v) => {
        const discountDisplay = v.discount_type === 'percentage'
            ? `${Number(v.value || 0)}%`
            : `${Number(v.value || 0).toLocaleString('vi-VN')} VNĐ`;

        const statusLabel = v.status === "active"
            ? '<span class="status success">Đang hoạt động</span>'
            : '<span class="status danger">Ngừng hoạt động</span>';

        const usageDisplay = v.usage_limit > 0
            ? `${v.usage_used || 0}/${v.usage_limit}`
            : "-";

        const validUntil = v.valid_until
            ? new Date(v.valid_until).toLocaleDateString("vi-VN")
            : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>${v.code || "-"}</td>
                    <td>${v.name || "Không có tên"}</td>
                    <td>${discountDisplay}</td>
                    <td>${usageDisplay}</td>
                    <td>${validUntil}</td>
                    <td>${statusLabel}</td>
                    <td>
                        <button class="btn-edit" onclick="openEditModal('${v.id}')">✏️</button>
                        <button class="btn-delete" onclick="deleteVoucher('${v.id}')">🗑️</button>
                    </td>
                `;
        tbody.appendChild(tr);
    });
}
// --- Bộ lọc trạng thái voucher ---
document.getElementById("statusFilter").addEventListener("change", function (e) {
    const selected = e.target.value;
    const tbody = document.querySelector("#voucherTableBody");
    tbody.innerHTML = "";

    let filtered = vouchers;
    if (selected === "active") {
        filtered = vouchers.filter(v => v.status === "active");
    } else if (selected === "inactive") {
        filtered = vouchers.filter(v => v.status !== "active");
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#999;">Không có voucher nào</td></tr>`;
        return;
    }

    filtered.forEach((v) => {
        const discountDisplay = v.discount_type === 'percentage'
            ? `${Number(v.value || 0)}%`
            : `${Number(v.value || 0).toLocaleString('vi-VN')} VNĐ`;

        const statusLabel = v.status === "active"
            ? '<span class="status success">Đang hoạt động</span>'
            : '<span class="status danger">Ngừng hoạt động</span>';

        const usageDisplay = v.usage_limit > 0
            ? `${v.usage_used || 0}/${v.usage_limit}`
            : "-";

        const validUntil = v.valid_until
            ? new Date(v.valid_until).toLocaleDateString("vi-VN")
            : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${v.code || "-"}</td>
            <td>${v.name || "Không có tên"}</td>
            <td>${discountDisplay}</td>
            <td>${usageDisplay}</td>
            <td>${validUntil}</td>
            <td>${statusLabel}</td>
            <td>
                <button class="btn-edit" onclick="openEditModal('${v.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteVoucher('${v.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
});

document.querySelector('#voucherModal form').addEventListener('submit', saveVoucher);
document.getElementById('voucherModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});
document.getElementById('searchInput').addEventListener('keyup', function (e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#voucherTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

loadVouchers();

// ===== Đăng xuất =====
document.getElementById("logoutBtn").addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn đăng xuất không?")) {
        localStorage.removeItem("token");
        alert("Đã đăng xuất!");
        window.location.href = "http://localhost:5500/login.html";
    }
});

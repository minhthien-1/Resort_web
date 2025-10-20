// admin/js/customers.js

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Chưa login hoặc không phải admin/staff => về login
  if (!token || (role !== "admin" && role !== "staff")) {
    window.location.href = "/login.html";
    return;
  }

  // Tải danh sách guest
  loadGuests();
});

async function loadGuests() {
  try {
    const res = await fetch('/api/admin/customers', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (!res.ok) throw new Error('Fetch lỗi');
    const guests = await res.json();

    const ul = document.getElementById('guestList');
    ul.innerHTML = '';

    guests.forEach(g => {
      const li = document.createElement('li');
      li.className = 'guest-item';
      li.innerHTML = `
        <div class="guest-info">
          <span>${g.full_name}</span>
          <span>${g.email}</span>
        </div>
        <button class="btn-detail" data-id="${g.id}">Xem thêm</button>
      `;
      ul.appendChild(li);
    });

    // Gắn sự kiện cho nút “Xem thêm”
    document.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        viewDetail(btn.dataset.id);
      });
    });

  } catch (err) {
    console.error(err);
    alert('Lỗi tải danh sách guest');
  }
}

async function viewDetail(id) {
  try {
    const res = await fetch(`/api/admin/customers/${id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (!res.ok) throw new Error('Không tìm thấy');

    const u = await res.json();
    document.getElementById('detailId').textContent = u.id;
    document.getElementById('detailName').textContent = u.full_name;
    document.getElementById('detailUsername').textContent = u.username || '—';
    document.getElementById('detailEmail').textContent = u.email;
    document.getElementById('detailPhone').textContent = u.phone || '—';
    //document.getElementById('detailAddress').textContent = u.address || '—';

    document.getElementById('detailModal').style.display = 'flex';
  } catch (err) {
    console.error(err);
    alert('Lỗi lấy chi tiết khách hàng');
  }
}

function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
}



document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Bạn có chắc muốn đăng xuất không?")) {
    localStorage.removeItem("token");
    alert("Đã đăng xuất!");
    window.location.href = "http://localhost:5500/login.html";
  }
});

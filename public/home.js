// home.js – Script for public/home.html
const API_BASE = window.location.origin + '/api';

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/&/g, "-and-")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Format tiền VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// 🏝️ Tạo card resort (clickable)
function createResortCard(resort) {
  // ✅ FIX: Xử lý images là array
  let imgSrc = 'assets/default.jpg';
  
  if (resort.images) {
    // Nếu images là array
    if (Array.isArray(resort.images)) {
      imgSrc = resort.images[0] ? `/uploads/${resort.images[0]}` : 'assets/default.jpg';
    }
    // Nếu images là string
    else if (typeof resort.images === 'string' && resort.images.trim()) {
      const firstImage = resort.images.split(',')[0].trim();
      imgSrc = `/uploads/${firstImage}`;
    }
  }
  
  const price = formatCurrency(resort.price_per_night || 0);
  const title = (resort.resort_name || "Không tên").replace(/"/g, '&quot;');
  const loc = (resort.location || "Chưa xác định").replace(/"/g, '&quot;');

  return `
    <div class="resort-card" data-id="${resort.id}">
      <img src="${imgSrc}" alt="${title}" onerror="this.src='assets/default.jpg'" />
      <div class="resort-info">
        <h3>${title}</h3>
        <p><i class="fas fa-map-marker-alt"></i> ${loc}</p>
        <p><strong>${resort.room_type || ''}</strong> • ${resort.capacity || 1} khách</p>
        <p class="price">${price} / đêm</p>
      </div>
    </div>
  `;
}


// 📦 Lấy danh sách resort từ API
async function fetchResorts(params = {}) {
  const url = new URL(`${API_BASE}/rooms`, window.location.origin);
  Object.keys(params).forEach(k => {
    if (params[k]) url.searchParams.append(k, params[k]);
  });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (err) {
    console.error('Fetch resorts failed', err);
    return [];
  }
}

// 🏷️ Lấy danh sách loại phòng
async function fetchRoomTypes() {
  try {
    const res = await fetch(`${API_BASE}/room-types`);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (err) {
    console.error('Fetch room types failed', err);
    return [];
  }
}

// 🧱 Render resorts lên UI
async function renderResorts(filter = {}) {
  const listEl = document.getElementById('room-cards-container');
  const msgContainer = document.querySelector('.search-instructions');

  if (msgContainer) msgContainer.innerHTML = '';
  listEl.innerHTML = '<p>Đang tải...</p>';

  const resorts = await fetchResorts(filter);

  const hasFilter = filter.location || filter.checkin || filter.room_type;
  if (msgContainer && hasFilter) {
    msgContainer.innerHTML = resorts.length
      ? `<div class="search-result-message success"><i class="fas fa-check-circle"></i> Tìm thấy ${resorts.length} resort</div>`
      : `<div class="search-result-message error"><i class="fas fa-exclamation-circle"></i> Không tìm thấy resort phù hợp.</div>`;
  }

  if (resorts.length === 0) {
    listEl.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }

  listEl.innerHTML = resorts.map(createResortCard).join('');

  // ✅ Thêm sự kiện click cho tất cả card
  document.querySelectorAll('.resort-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      if (id) {
        window.location.href = `room.html?id=${id}`;
      }
    });
  });
}

// 🧩 Điền các loại phòng vào select
async function populateRoomTypeSelect() {
  const types = await fetchRoomTypes();
  const select = document.getElementById('roomType');
  if (!select) return;

  select.innerHTML = '<option value="">Tất cả loại phòng</option>';
  types.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}

// 🚀 Khi load trang
document.addEventListener('DOMContentLoaded', () => {
  renderResorts();

  if (window.flatpickr) {
    flatpickr("#dateRange", {
      mode: "range",
      dateFormat: "d/m/Y",
      locale: "vn",
      minDate: "today"
    });
  }

  populateRoomTypeSelect();

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const rawLocation = document.getElementById('location').value;
      const location = slugify(rawLocation);
      const dateRange = document.getElementById('dateRange').value;
      const roomType = document.getElementById('roomType').value;

      let checkin = '', checkout = '';
      if (dateRange.includes(' to ')) {
        [checkin, checkout] = dateRange.split(' to ').map(d => d.trim());
      } else if (dateRange.includes(' - ')) {
        [checkin, checkout] = dateRange.split(' - ').map(d => d.trim());
      }

      const filter = { location, checkin, checkout, room_type: roomType };
      renderResorts(filter);
      document.getElementById('room-cards-container').scrollIntoView({ behavior: 'smooth' });
    });
  }

  const locationInput = document.getElementById('location');
  if (locationInput && searchBtn) {
    locationInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
      }
    });
  }

  // 🧭 Scroll deals (nếu có)
  const grid = document.getElementById("dealsGrid");
  const btnLeft = document.querySelector(".promo-arrow.left");
  const btnRight = document.querySelector(".promo-arrow.right");

  if (grid && btnLeft && btnRight) {
    function scrollByOneCard(direction) {
      const card = grid.querySelector(".resort-card");
      if (!card) return;
      const cardStyle = window.getComputedStyle(card);
      const cardWidth = card.offsetWidth + parseFloat(cardStyle.marginRight);

      grid.scrollBy({
        left: direction === "right" ? cardWidth : -cardWidth,
        behavior: "smooth"
      });
    }

    btnLeft.addEventListener("click", () => scrollByOneCard("left"));
    btnRight.addEventListener("click", () => scrollByOneCard("right"));
  }
});

// 🔔 Tải số thông báo chưa đọc
async function loadUnread() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch("http://localhost:5500/notifications/unread-count", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  document.getElementById("badge").innerText = data.unread;
}

loadUnread();

// home.js – Script for public/home.html
const API_BASE = window.location.origin + '/api';

// Format tiền VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// Tạo card resort
function createResortCard(r) {
  return `
    <div class="resort-card">
      <img src="${r.image_url || 'assets/default.jpg'}" alt="${r.name}" />
      <div class="resort-info">
        <h3>${r.name}</h3>
        <p>${r.location}</p>
        <p class="price">${formatCurrency(r.price_per_night)}</p>
      </div>
    </div>
  `;
}

// Lấy danh sách resort từ API
async function fetchResorts(params = {}) {
  const url = new URL(`${API_BASE}/public/resorts`, window.location.origin);
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

// Render resort lên UI
async function renderResorts(filter = {}) {
  const listEl = document.getElementById('resortList');
  listEl.innerHTML = '<p>Đang tải...</p>';
  const resorts = await fetchResorts(filter);
  if (resorts.length === 0) {
    listEl.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }
  listEl.innerHTML = resorts.map(createResortCard).join('');
}

// Xử lý sự kiện search
document.getElementById('searchBtn').addEventListener('click', () => {
  const location = document.getElementById('location').value;
  const dateRange = document.getElementById('dateRange').value;
  const guests = document.getElementById('guests').value;

  // Tách ngày nhận / trả từ "dd/mm/yyyy - dd/mm/yyyy"
  let checkin = '', checkout = '';
  if (dateRange.includes(' - ')) {
    const [start, end] = dateRange.split(' - ');
    checkin = start.trim();
    checkout = end.trim();
  }

  const filter = { location, checkin, checkout, guests };
  renderResorts(filter);
});

// Khi load trang, hiển thị mặc định
document.addEventListener('DOMContentLoaded', () => {
  renderResorts();

  // === Khởi tạo Flatpickr tiếng Việt ===
  if (window.flatpickr) {
    flatpickr("#dateRange", {
      mode: "range",
      dateFormat: "d/m/Y",
      locale: "vn"  
    });
  }
});

document.addEventListener("DOMContentLoaded", function() {
  const grid = document.getElementById("dealsGrid");
  const btnLeft = document.querySelector(".deals-arrow.left");
  const btnRight = document.querySelector(".deals-arrow.right");

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
});


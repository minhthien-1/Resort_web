// home.js – Script for public/home.html
const API_BASE = window.location.origin + '/api';
function slugify(text) {
  return text
    .normalize("NFD")                                 // tách dấu
    .replace(/[\u0300-\u036f]/g, "")                 // loại bỏ combining marks
    .replace(/Đ/g, "D")                              
    .replace(/đ/g, "d")
    .replace(/&/g, "-and-")                           // ví dụ chuyển & → and
    .replace(/[^a-zA-Z0-9\s-]/g, "")                  // loại bỏ ký tự không phải chữ số/chữ cái/khoảng trắng/hyphen
    .trim()                                          
    .toLowerCase()
    .replace(/\s+/g, "-")                             // spaces → hyphens
    .replace(/-+/g, "-");                             // gộp nhiều hyphen thành 1
}


// Format tiền VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}


// Tạo card resort
function createResortCard(r) {
  // Lấy tên, địa điểm, giá và hình ảnh đúng key
  const title = r.resort_name || r.room_type || 'Không tên';
  const loc   = r.location || 'Chưa xác định';
  const img   = (r.images && r.images[0]) || 'assets/default.jpg';
  const price = r.price_per_night || r.price || 0;

  return `
    <div class="resort-card">
      <img src="${img}" alt="${title}" />
      <div class="resort-info">
        <h3>${title}</h3>
        <p><i class="fas fa-map-marker-alt"></i> ${loc}</p>
        <p class="price">Từ ${formatCurrency(price)}/đêm</p>
      </div>
    </div>
  `;
}



// Lấy danh sách resort từ API
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


// Lấy danh sách loại phòng từ API
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


// Render resort lên UI
async function renderResorts(filter = {}) {
  const listEl = document.getElementById('room-cards-container');
  const msgContainer = document.querySelector('.search-instructions');

  if (msgContainer) msgContainer.innerHTML = ''; // Xóa thông báo cũ
  listEl.innerHTML = '<p>Đang tải...</p>';

  const resorts = await fetchResorts(filter);

  // Hiển thị thông báo kết quả
  const hasFilter = filter.location || filter.checkin || filter.room_type;
  if (msgContainer && hasFilter) {
    if (resorts.length === 0) {
      msgContainer.innerHTML = `
        <div class="search-result-message error">
          <i class="fas fa-exclamation-circle"></i>
          Không tìm thấy resort phù hợp. Hãy thử tìm kiếm khác!
        </div>
      `;
    } else {
      msgContainer.innerHTML = `
        <div class="search-result-message success">
          <i class="fas fa-check-circle"></i>
          Tìm thấy ${resorts.length} resort
        </div>
      `;
    }
  }

  if (resorts.length === 0) {
    listEl.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }

  listEl.innerHTML = resorts.map(createResortCard).join('');
}


// Điền các loại phòng vào select
async function populateRoomTypeSelect() {
  const types = await fetchRoomTypes();
  const select = document.getElementById('roomType');
  if (!select) return;
  // giữ option đầu rồi thêm các type
  select.innerHTML = '<option value="">Tất cả loại phòng</option>';
  types.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}


// Khi load trang
document.addEventListener('DOMContentLoaded', () => {
  // 1. Render resorts mặc định
  renderResorts();

  // 2. Khởi tạo Flatpickr
  if (window.flatpickr) {
    flatpickr("#dateRange", {
      mode: "range",
      dateFormat: "d/m/Y",
      locale: "vn",
      minDate: "today"
    });
  }

  // 3. Populate room types dropdown
  populateRoomTypeSelect();

  // 4. Xử lý nút tìm kiếm
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const rawLocation = document.getElementById('location').value;   // "Hà Nội"
      const location = slugify(rawLocation);                            // "ha-noi"
      const dateRange = document.getElementById('dateRange').value;
      const roomType = document.getElementById('roomType').value;

      // Tách ngày - xử lý cả "to" và "-"
      let checkin = '', checkout = '';
      if (dateRange.includes(' to ')) {
        const [start, end] = dateRange.split(' to ');
        checkin = start.trim();
        checkout = end.trim();
      } else if (dateRange.includes(' - ')) {
        const [start, end] = dateRange.split(' - ');
        checkin = start.trim();
        checkout = end.trim();
      }

      const filter = { location, checkin, checkout, room_type: roomType };
      renderResorts(filter);

      // Scroll đến kết quả
      document.getElementById('room-cards-container').scrollIntoView({
        behavior: 'smooth'
      });
    });
  }

  // 5. Tìm kiếm bằng Enter trong ô location
  const locationInput = document.getElementById('location');
  if (locationInput && searchBtn) {
    locationInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
      }
    });
  }

  // 6. Xử lý scroll deals/promo
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

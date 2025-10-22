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

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function createResortCard(r) {
  const title = r.resort_name || r.room_type || 'Không tên';
  const loc = r.location || 'Chưa xác định';
  const img = (r.images && r.images[0]) || 'Assets/placeholder.jpg';
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

async function fetchResorts(params = {}) {
  const url = new URL(`${API_BASE}/rooms`);
  Object.keys(params).forEach(k => { if (params[k]) url.searchParams.append(k, params[k]); });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (err) {
    console.error('Fetch resorts failed', err);
    return [];
  }
}

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

// ===== Pagination variables =====
let allRooms = [];
let currentPage = 1;
const itemsPerPage = 6;

async function renderResorts(filter = {}) {
  const listEl = document.getElementById('room-cards-container');
  const msgContainer = document.querySelector('.search-instructions');

  if (msgContainer) msgContainer.innerHTML = '';
  if (listEl) listEl.innerHTML = '<p>Đang tải...</p>';

  allRooms = await fetchResorts(filter);
  currentPage = 1;
  renderRoomsForCurrentPage();
  renderPagination();

  // Show search message
  const hasFilter = filter.location || filter.checkin || filter.room_type;
  if (msgContainer && hasFilter) {
    if (allRooms.length === 0) {
      msgContainer.innerHTML = `<div class="search-result-message error"><i class="fas fa-exclamation-circle"></i> Không tìm thấy resort phù hợp. Hãy thử tìm kiếm khác!</div>`;
    } else {
      msgContainer.innerHTML = `<div class="search-result-message success"><i class="fas fa-check-circle"></i> Tìm thấy ${allRooms.length} resort</div>`;
    }
  }

  if (allRooms.length === 0) listEl.innerHTML = '<p>Không tìm thấy kết quả.</p>';
}

function renderRoomsForCurrentPage() {
  const container = document.getElementById('room-cards-container');
  if (!container) return;
  container.innerHTML = '';

  if (!allRooms.length) {
    container.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  allRooms.slice(start, end).forEach(r => container.innerHTML += createResortCard(r));
}

function renderPagination() {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  paginationContainer.innerHTML = '';
  const totalPages = Math.ceil(allRooms.length / itemsPerPage);
  if (totalPages <= 1) return;

  const createBtn = (html, disabled, onClick) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.innerHTML = html;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  };

  paginationContainer.appendChild(createBtn('<i class="fas fa-chevron-left"></i>', currentPage === 1, () => { currentPage--; renderRoomsForCurrentPage(); renderPagination(); }));
  for (let i = 1; i <= totalPages; i++) {
    const btn = createBtn(i, false, () => { currentPage = i; renderRoomsForCurrentPage(); renderPagination(); });
    if (i === currentPage) btn.classList.add('active');
    paginationContainer.appendChild(btn);
  }
  paginationContainer.appendChild(createBtn('<i class="fas fa-chevron-right"></i>', currentPage === totalPages, () => { currentPage++; renderRoomsForCurrentPage(); renderPagination(); }));
}

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

document.addEventListener('DOMContentLoaded', () => {
  // 1. Render initial resorts
  renderResorts();

  // 2. Flatpickr
  if (window.flatpickr) {
    flatpickr("#dateRange", { mode: "range", dateFormat: "d/m/Y", locale: "vn", minDate: "today" });
  }

  // 3. Populate room types
  populateRoomTypeSelect();

  // 4. Search button
  const searchBtn = document.getElementById('searchBtn');
  searchBtn?.addEventListener('click', () => {
    const rawLocation = document.getElementById('location').value;
    const location = slugify(rawLocation);
    const dateRange = document.getElementById('dateRange').value;
    const roomType = document.getElementById('roomType').value;

    let checkin = '', checkout = '';
    if (dateRange.includes(' to ')) [checkin, checkout] = dateRange.split(' to ').map(s => s.trim());
    else if (dateRange.includes(' - ')) [checkin, checkout] = dateRange.split(' - ').map(s => s.trim());

    const filter = { location, checkin, checkout, room_type: roomType };
    renderResorts(filter);
    document.getElementById('room-cards-container').scrollIntoView({ behavior: 'smooth' });
  });

  // 5. Enter key in location input
  const locationInput = document.getElementById('location');
  locationInput?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); } });

  // 6. Scroll deals/promo
  const dealsGrid = document.getElementById("dealsGrid");
  const btnLeft = document.querySelector(".promo-arrow.left");
  const btnRight = document.querySelector(".promo-arrow.right");

  if (dealsGrid && btnLeft && btnRight) {
    const scrollByOneCard = (dir) => {
      const card = dealsGrid.querySelector(".resort-card");
      if (!card) return;
      const cardWidth = card.offsetWidth + parseFloat(window.getComputedStyle(card).marginRight);
      dealsGrid.scrollBy({ left: dir === "right" ? cardWidth : -cardWidth, behavior: "smooth" });
    };
    btnLeft.addEventListener("click", () => scrollByOneCard("left"));
    btnRight.addEventListener("click", () => scrollByOneCard("right"));
  }
});

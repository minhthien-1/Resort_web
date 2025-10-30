
const API_BASE_URL = window.location.origin + '/api';

/**
 * Format số tiền thành định dạng VND
 @param {number} amount 
 @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

/**
 * Fetch danh sách phòng từ API
 * @returns {Promise<Array>}
 */
async function fetchRooms() {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch rooms failed:', error);
    return [];
  }
}

/**
 * Cập nhật bảng phòng với dữ liệu từ API
 * @param {Array} rooms 
 */
function renderRoomsTable(rooms) {
  const tbody = document.querySelector('#roomsTable tbody');
  if (!tbody) return;

  if (rooms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:1rem;">
          Không có dữ liệu phòng
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rooms.map(room => `
    <tr>
      <td>${room.resort_name || ''}</td>
      <td>${room.room_type}</td>
      <td>
        <span class="status status--${room.status}">
          ${room.status.replace('_', ' ')}
        </span>
      </td>
      <td>${formatCurrency(Number(room.price_per_night || 0))}</td>
    </tr>
  `).join('');
}

/**
 * Hiển thị thông báo lỗi lên UI
 * @param {string} message 
 */
function showError(message) {
  const errorDiv = document.querySelector('#errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  } else {
    alert(message);
  }
}

/**
 * Tải và render dữ liệu dashboard khi trang load xong
 */
async function initDashboard() {
  try {
    const rooms = await fetchRooms();
    renderRoomsTable(rooms);
  } catch (error) {
    showError('Không thể tải dữ liệu phòng. Vui lòng thử lại sau.');
  }
}

// Thiết lập sự kiện DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

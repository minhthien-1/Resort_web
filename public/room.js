document.addEventListener("DOMContentLoaded", async () => {
  const roomContainer = document.getElementById("room-container");
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("id");

  if (!roomId) {
    roomContainer.innerHTML = `<p>❌ Không tìm thấy ID phòng.</p>`;
    return;
  }

  try {
    const res = await fetch(`/api/rooms/${roomId}`);
    if (!res.ok) throw new Error("Network error");
    const room = await res.json();

    // ✅ Normalize images
    const images = Array.isArray(room.images)
      ? room.images
      : typeof room.images === "string"
      ? room.images.split(",")
      : [];

    // Build HTML
    roomContainer.innerHTML = `
      <div class="room-header">
        <h1>${room.resort_name}</h1>
        <p><strong>Địa điểm:</strong> ${room.location}</p>
        <p><strong>Loại phòng:</strong> ${room.room_type}</p>
        <p><strong>Giá mỗi đêm:</strong> $${room.price_per_night}</p>
      </div>
      <div class="room-body">
        <div class="room-gallery">
          ${
            images.length
              ? images.map(url => `<img src="${url}" alt="Ảnh phòng">`).join("")
              : "<p>Không có hình ảnh</p>"
          }
        </div>
        <div class="room-description">
          <h3>Mô tả</h3>
          <p>${room.description}</p>
          <h3>Tiện nghi</h3>
          <p>${room.features}</p>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("❌ Lỗi tải thông tin phòng:", error);
    roomContainer.innerHTML = `<p>Lỗi tải thông tin resort.</p>`;
  }
});

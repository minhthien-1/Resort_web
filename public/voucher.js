const vouchers = [
  {
    icon: "✈️",
    title: "Giảm đến 75,000 cho lần đặt vé máy bay đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🏨",
    title: "Giảm đến 10% cho lần đặt phòng khách sạn đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },{
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  },
  {
    icon: "🎟️",
    title: "Giảm đến 10% cho lần đặt vé tham quan/hoạt động đầu tiên.",
    desc: "Áp dụng cho lần đặt đầu tiên trên ứng dụng Traveloka.",
    code: "TVLKBANMOI",
  }
];

const promoGrid = document.getElementById("promoGrid");

promoGrid.innerHTML = vouchers.map(voucher => `
  <div class="promo-card">
    <div class="promo-header">
      <span class="promo-icon">${voucher.icon}</span>
      <p><strong>${voucher.title}</strong></p>
    </div>
    <p class="promo-desc">${voucher.desc}</p>
    <div class="promo-footer">
      <span class="promo-code">${voucher.code}</span>
      <button class="copy-btn" data-code="${voucher.code}">Copy</button>
    </div>
  </div>
`).join("");

// Copy-to-clipboard
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const code = btn.dataset.code;
    navigator.clipboard.writeText(code);
    btn.textContent = "Đã sao chép!";
    btn.style.background = "#00b894";
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.style.background = "#0071eb";
    }, 1200);
  });
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Lấy giá trị từ các ô input
  const fullName = document.getElementById("fullName").value.trim();
  const username = document.getElementById("Uname").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  // Kiểm tra mật khẩu nhập lại
  if (password !== confirmPassword) {
    alert("❌ Mật khẩu nhập lại không khớp!");
    return;
  }

  try {
    // Gửi yêu cầu đến server
    const res = await fetch("http://localhost:5500/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        username,
        email,
        phone,
        password
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Đăng ký thành công! Hãy đăng nhập.");
      window.location.href = "login.html";
    } else {
      alert(`❌ Lỗi: ${data.error || "Không thể đăng ký"}`);
    }
  } catch (err) {
    console.error("Lỗi khi gửi yêu cầu đăng ký:", err);
    alert("❌ Không thể kết nối đến server.");
  }
});

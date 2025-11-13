document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin",
      text: "Vui lòng nhập đầy đủ email/username và mật khẩu!"
    });
    return;
  }

  try {
    const response = await fetch("https://api-resort.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password })
    });

    const data = await response.json();

    if (response.ok) {
      Swal.fire({
        icon: "success",
        title: "Đăng nhập thành công!"
      }).then(() => {
        // ✅ FIX: Lưu từ data.user:
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user.id);           // ← FIX: data.user.id
        localStorage.setItem("username", data.user.username);   // ← FIX: data.user.username
        localStorage.setItem("email", data.user.email);         // ← Giữ nguyên
        localStorage.setItem("full_name", data.user.full_name || "");  // ← FIX: full_name (không phải fullname)
        localStorage.setItem("phone", data.user.phone || "");    // ← FIX
        localStorage.setItem("role", data.user.role);           // ← FIX
        if (data.user.role === "admin" || data.user.role === "staff") {
          window.location.href = "/admin";
        } else {
          window.location.href = "home.html";
        }
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Đăng nhập thất bại",
        text: data.error || "Sai email/username hoặc mật khẩu!"
      });
    }
  } catch (err) {
    console.error("💥 Lỗi fetch:", err);
    Swal.fire({
      icon: "error",
      title: "Lỗi kết nối",
      text: "Không thể kết nối tới máy chủ!"
    });
  }
});

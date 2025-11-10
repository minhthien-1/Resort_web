

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("⚠️ Vui lòng nhập đầy đủ email và mật khẩu!");
    return;
  }

  try {
    const response = await fetch("http://localhost:5500/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ Đăng nhập thành công!");
      
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("full_name", data.full_name);
      
      // SỬA ĐỔI: Giữ nguyên cách lưu email của bạn
      localStorage.setItem("email", email); 

      localStorage.setItem("role", data.role);
      
      // SỬA ĐỔI: Chỉ thêm dòng này để lưu số điện thoại
      localStorage.setItem('phone', data.phone);
      
      if (data.role === "admin" || data.role === "staff") {
        window.location.href = "/admin";
      } else {
        window.location.href = "home.html";
      }
    } else {
      alert(data.error || "❌ Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("💥 Lỗi fetch:", err);
    alert("Không thể kết nối đến máy chủ!");
  }
}); 



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

    const text = await response.text();
    let data = JSON.parse(text);

    if (response.ok) {
      alert("✅ Đăng nhập thành công!");
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id); // ⭐ LƯU ID
      localStorage.setItem("username", data.username);
      localStorage.setItem("fullname", data.full_name);
      localStorage.setItem("full_name", data.full_name);
      localStorage.setItem("email", email);
      localStorage.setItem("role", data.role);
      
      if (data.role === "admin") {
        window.location.href = "admin";
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



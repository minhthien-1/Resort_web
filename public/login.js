document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("⚠️ Vui lòng nhập đầy đủ email và mật khẩu!");
    return;
  }

  try {
    console.log("🔹 Gửi yêu cầu đăng nhập...");

    const response = await fetch("http://localhost:5500/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    console.log("📩 Phản hồi HTTP:", response.status);

    const text = await response.text();
    console.log("🧾 Nội dung phản hồi:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ Không thể parse JSON:", err);
      alert("Lỗi phản hồi từ máy chủ!");
      return;
    }

    if (response.ok) {
      alert("✅ Đăng nhập thành công!");
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("fullname", data.full_name);
      localStorage.setItem("role", data.role);
      window.location.href = "home.html";
    } else {
      alert(data.error || "❌ Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("💥 Lỗi fetch:", err);
    alert("Không thể kết nối đến máy chủ. Kiểm tra lại server!");
  }
});

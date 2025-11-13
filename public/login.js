//NỘI DUNG CŨA FILE login.js

/*document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("⚠️ Vui lòng nhập đầy đủ email và mật khẩu!");
    return;
  }

  try {
    const response = await fetch("https://api-resort.onrender.com/api/auth/login", {
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
}); */

//Update with SweetAlert2
//Nội dung mới 
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin",
      text: "Vui lòng nhập đầy đủ email và mật khẩu!"
    });
    return;
  }

  try {
    const response = await fetch("https://api-resort.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      Swal.fire({
        icon: "success",
        title: "Đăng nhập thành công!"
      }).then(() => {

        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.id);
        localStorage.setItem("username", data.username);
        localStorage.setItem("full_name", data.full_name);
        localStorage.setItem("email", email);
        localStorage.setItem("role", data.role);
        localStorage.setItem("phone", data.phone);

        if (data.role === "admin" || data.role === "staff") {
          window.location.href = "/admin";
        } else {
          window.location.href = "home.html";
        }
      });

    } else {
      Swal.fire({
        icon: "error",
        title: "Đăng nhập thất bại",
        text: data.error || "Sai email hoặc mật khẩu!"
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

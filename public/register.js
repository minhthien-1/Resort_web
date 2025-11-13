document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Lấy giá trị từ các ô input
  const fullName = document.getElementById("fullName").value.trim();
  const username = document.getElementById("Uname").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  // ===== VALIDATION =====

  // 1. Kiểm tra họ và tên
  if (!fullName) {
    alert("❌ Họ và tên không được để trống!");
    return;
  }
  if (fullName.length > 20) {
    alert("❌ Họ và tên không được vượt quá 20 ký tự!");
    return;
  }
  // Không có ký tự đặc biệt, chỉ cho phép chữ, số, khoảng trắng
  if (!/^[a-zA-Z0-9\s\u0100-\uFFFF]+$/.test(fullName)) {
    alert("❌ Họ và tên không được chứa ký tự đặc biệt!");
    return;
  }

  // 2. Kiểm tra username
  if (!username) {
    alert("❌ Tên đăng nhập không được để trống!");
    return;
  }
  if (username.length > 20) {
    alert("❌ Tên đăng nhập không được vượt quá 20 ký tự!");
    return;
  }
  // Chỉ cho phép chữ, số, dấu gạch dưới, dấu gạch ngang
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    alert("❌ Tên đăng nhập chỉ được chứa chữ, số, dấu gạch dưới và dấu gạch ngang!");
    return;
  }

  // 3. Kiểm tra email
  if (!email) {
    alert("❌ Email không được để trống!");
    return;
  }
  if (email.length > 30) {
    alert("❌ Email không được vượt quá 30 ký tự!");
    return;
  }
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("❌ Email không hợp lệ!");
    return;
  }

  // 4. Kiểm tra số điện thoại
  if (!phone) {
    alert("❌ Số điện thoại không được để trống!");
    return;
  }
  // Phải là 10 chữ số, bắt đầu bằng 0
  if (!/^0[0-9]{9}$/.test(phone)) {
    alert("❌ Số điện thoại phải là 10 chữ số và bắt đầu bằng 0!");
    return;
  }

  // 5. Kiểm tra mật khẩu
  if (!password) {
    alert("❌ Mật khẩu không được để trống!");
    return;
  }
  if (password.length < 5) {
    alert("❌ Mật khẩu phải có ít nhất 5 ký tự!");
    return;
  }
  
  // Mật khẩu phải chứa: số, chữ thường, chữ hoa, ký tự đặc biệt
  const hasNumber = /[0-9]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasNumber) {
    alert("❌ Mật khẩu phải chứa ít nhất 1 chữ số,1 chữ thường, 1 chữ hoa và 1 ký tự đặc biệt!");
    return;
  }
  if (!hasLower) {
    alert("❌ Mật khẩu phải chứa ít nhất 1 chữ số,1 chữ thường, 1 chữ hoa và 1 ký tự đặc biệt!");
    return;
  }
  if (!hasUpper) {
    alert("❌ Mật khẩu phải chứa ít nhất 1 chữ số,1 chữ thường, 1 chữ hoa và 1 ký tự đặc biệt!");
    return;
  }
  if (!hasSpecial) {
    alert("❌ Mật khẩu phải chứa ít nhất 1 chữ số,1 chữ thường, 1 chữ hoa và 1 ký tự đặc biệt!");
    return;
  }

  // 6. Kiểm tra mật khẩu nhập lại
  if (password !== confirmPassword) {
    alert("❌ Mật khẩu nhập lại không khớp!");
    return;
  }

  // ===== NẾU TẤT CẢ HỢP LỆ, GỬI ĐẾN SERVER =====

  try {
    // Gửi yêu cầu đến server
    const res = await fetch("https://api-resort.onrender.com/api/auth/register", {
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
      // Xử lý lỗi từ server
      if (data.error === "Username already exists") {
        alert("❌ Tên đăng nhập đã tồn tại!");
      } else if (data.error === "Email already exists") {
        alert("❌ Email đã tồn tại!");
      } else if (data.error === "Phone already exists") {
        alert("❌ Số điện thoại đã tồn tại!");
      } else {
        alert(`❌ Lỗi: ${data.error || "Không thể đăng ký"}`);
      }
    }
  } catch (err) {
    console.error("Lỗi khi gửi yêu cầu đăng ký:", err);
    alert("❌ Không thể kết nối đến server.");
  }
});
// ===== IMPORTS =====
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "./db.js";

// ===== CẤU HÌNH CƠ BẢN =====
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Xác định __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== SERVE STATIC =====
// Serve frontend User (thư mục public)
app.use(
  "/",
  express.static(path.join(__dirname, "../public"))
);

// Serve frontend Admin (thư mục admin/public)
app.use(
  "/admin",
  express.static(path.join(__dirname, "../admin/public"))
);

// ===== ROUTES GỐC =====
// User home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});

// Admin home page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../admin/public/home.html"));
});

// ===== HEALTH CHECK =====
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== AUTH APIs =====
// Đăng ký
app.post("/auth/register", async (req, res) => {
  const { fullName, username, email, phone, password } = req.body;

  if (!fullName || !username || !email || !phone || !password) {
    return res.status(400).json({ error: "Thiếu thông tin đăng ký" });
  }

  try {
    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thực hiện INSERT vào PostgreSQL
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'customer', true)`,
      [username, email, hashedPassword, fullName, phone]
    );

    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.error("Lỗi khi đăng ký:", err);
    if (err.code === "23505") {
      res.status(400).json({ error: "Email hoặc Username đã tồn tại" });
    } else {
      res.status(500).json({ error: "Lỗi server khi đăng ký" });
    }
  }
});


// Đăng nhập
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("📩 Login request:", email);

  try {
    const { rows } = await pool.query(
      "SELECT id, email, username, password_hash, role, full_name FROM users WHERE email=$1 AND is_active=true",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Tài khoản không tồn tại hoặc bị khóa" });
    }

    const user = rows[0];

    // ✅ So sánh mật khẩu thực sự với bcrypt
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "8h" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập chi tiết:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});


// ===== HOTEL MANAGEMENT APIs =====
// API 1: Tổng số booking
app.get("/api/bookings/total", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*) AS total FROM bookings");
    res.json({ total: Number(r.rows[0].total) });
  } catch (err) {
    console.error("❌ Lỗi khi lấy tổng booking:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API 2: Tổng doanh thu toàn hệ thống (sử dụng cho ô xanh lá)
app.get("/api/revenue/total", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS total_revenue
      FROM bookings
      WHERE status = 'confirmed';
    `);
    console.log("🟢 API /api/revenue/total:", result.rows[0]);
    res.json({ total_revenue: Number(result.rows[0].total_revenue) });
  } catch (err) {
    console.error("❌ Lỗi khi tính tổng doanh thu:", err);
    res.status(500).json({ error: "Lỗi khi tính tổng doanh thu" });
  }
});

// API 3: Doanh thu tháng hiện tại (tháng 10/2025) - cho ô cam
app.get("/api/revenue/current-month", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS monthly_revenue
      FROM bookings
      WHERE status = 'confirmed'
        AND EXTRACT(MONTH FROM check_in) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM check_in) = EXTRACT(YEAR FROM CURRENT_DATE);
    `);
    console.log("🟠 API /api/revenue/current-month:", rows[0]);
    res.json({ monthly_revenue: Number(rows[0].monthly_revenue) });
  } catch (err) {
    console.error("❌ Lỗi khi lấy doanh thu tháng hiện tại:", err);
    res.status(500).json({ error: "Lỗi server khi lấy doanh thu tháng hiện tại" });
  }
});

// API 4: Số khách mới trong 30 ngày gần nhất
app.get("/api/guests/new", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT COUNT(*) AS new_guests
      FROM guests
      WHERE created_at > NOW() - INTERVAL '30 days';
    `);
    res.json({ new_guests: Number(r.rows[0].new_guests) });
  } catch (err) {
    console.error("❌ Lỗi khi lấy khách mới:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API 5: Xu hướng doanh thu theo tháng
app.get("/api/revenue/monthly", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', check_in), 'YYYY-MM') AS month,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM bookings
      WHERE status = 'confirmed'
      GROUP BY 1
      ORDER BY 1;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Lỗi khi lấy doanh thu theo tháng:", err);
    res.status(500).json({ error: "Lỗi server khi truy vấn doanh thu theo tháng" });
  }
});

// API 6: Danh sách phòng (nếu cần cho giao diện)
app.get("/api/rooms", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.room_number, r.status, 
             rt.name AS room_type, rt.price_per_night
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      ORDER BY r.room_number;
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== KHỞI CHẠY SERVER =====
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
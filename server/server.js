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

// Serve frontend (thư mục public)
app.use(express.static(path.join(__dirname, "../admin/public")));

// Route gốc (index)
app.get("/", (req, res) => {
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
  const { email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING id, role",
      [email, hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// Đăng nhập
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query(
    "SELECT id, password_hash, role FROM users WHERE email=$1",
    [email]
  );

  if (
    rows.length === 0 ||
    !(await bcrypt.compare(password, rows[0].password_hash))
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: rows[0].id, role: rows[0].role },
    process.env.JWT_SECRET || "defaultsecret",
    { expiresIn: "8h" }
  );

  res.json({ token });
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
    const result = await pool.query(`
      SELECT COUNT(*) AS new_guests
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days';
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error loading new guests:", err);
    res.status(500).json({ error: "Internal server error" });
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


// ===== IMPORTS =====
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { pool } from "./db.js";

// ===== CẤU HÌNH CƠ BẢN =====
dotenv.config();
const app = express();
app.use(
  cors({
    origin: "http://localhost:5500",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// ===== PATH SETUP =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== UPLOADS CONFIG =====
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ chấp nhận file ảnh"));
    }
    cb(null, true);
  },
});

// Middleware parse multipart/form-data
app.use((req, res, next) => {
  if (req.headers["content-type"]?.includes("multipart/form-data")) {
    upload.array("images")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (req.body?.data) {
        try {
          req.body = { ...req.body, ...JSON.parse(req.body.data) };
        } catch (e) {
          console.warn("Lỗi parse JSON data:", e);
        }
      }
      next();
    });
  } else next();
});

// ===== STATIC FILES =====

// 🟢 Public site (Home, Login, Register,...)
app.use(express.static(path.join(__dirname, "../public")));

// 🟢 Admin site (Dashboard, Voucher,...)
app.use("/admin", express.static(path.join(__dirname, "../admin/public")));

// 🟢 Upload folder
app.use("/uploads", express.static(UPLOAD_DIR));

// 🟢 Luôn ép "/" trả về home.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
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

// ===== AUTH MIDDLEWARE =====
function authorize(allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "defaultsecret"
      );
      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

// ===== AUTH APIs =====

// Đăng ký
app.post("/auth/register", async (req, res) => {
  const { fullName, username, email, phone, password, role } = req.body;
  if (!fullName || !username || !email || !phone || !password) {
    return res.status(400).json({ error: "Thiếu thông tin đăng ký" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [username, email, hashedPassword, fullName, phone, role || "guest"]
    );
    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (err) {
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
  try {
    const { rows } = await pool.query(
      "SELECT id, email, username, password_hash, role, full_name FROM users WHERE email=$1 AND is_active=true",
      [email]
    );
    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Tài khoản không tồn tại hoặc bị khóa" });
    }
    const user = rows[0];
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
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// ===== DASHBOARD APIs =====

// Tổng số booking
app.get("/api/bookings/total", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*) AS total FROM bookings");
    res.json({ total: Number(r.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi lấy tổng booking" });
  }
});

// Tổng doanh thu
app.get("/api/revenue/total", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS total_revenue
      FROM bookings WHERE status = 'confirmed';
    `);
    res.json({ total_revenue: Number(result.rows[0].total_revenue) });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi tính tổng doanh thu" });
  }
});

// Doanh thu tháng hiện tại
app.get("/api/revenue/current-month", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS monthly_revenue
      FROM bookings
      WHERE status = 'confirmed'
        AND EXTRACT(MONTH FROM check_in) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM check_in) = EXTRACT(YEAR FROM CURRENT_DATE);
    `);
    res.json({ monthly_revenue: Number(rows[0].monthly_revenue) });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy doanh thu tháng hiện tại" });
  }
});

// Số khách mới 30 ngày
app.get("/api/guests/new", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS new_guests
      FROM users WHERE created_at >= NOW() - INTERVAL '30 days';
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy khách mới" });
  }
});

// Doanh thu theo tháng
app.get("/api/revenue/monthly", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', check_in), 'YYYY-MM') AS month,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM bookings
      WHERE status = 'confirmed'
      GROUP BY 1 ORDER BY 1;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi truy vấn doanh thu theo tháng" });
  }
});

// ===== ROOMS APIs =====

// Public rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.resort_name, r.room_type_id, rt.name AS room_type,
             rt.price_per_night, rt.capacity, rd.images_url AS images,
             r.location, rd.description, rd.features
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN room_details rd ON rd.room_id = r.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
  }
});

// Admin: room types
app.get("/api/admin/room-types", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, price_per_night, capacity
      FROM room_types WHERE is_active = true ORDER BY price_per_night
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy loại phòng" });
  }
});

// Admin: rooms
app.get("/api/admin/rooms", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.resort_name, rt.name AS room_type,
             rt.price_per_night, rd.description, rd.features,
             rd.images_url AS images, r.status, r.category,
             r.location, r.address
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN room_details rd ON rd.room_id = r.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng admin" });
  }
});
// ===== DISCOUNTS APIs =====

// Lấy toàn bộ voucher
app.get("/api/discounts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, code, name, description, discount_type, value, 
        valid_from, valid_until, status,
        usage_limit, usage_used
      FROM discounts
      ORDER BY created_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách voucher:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách voucher" });
  }
});

// Thêm voucher mới
app.post("/api/discounts", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const {
      code = "",
      name = "",
      description = "",
      discount_type = "percent",
      value = null,
      valid_from,
      valid_until,
      status = "active",
      usage_limit = 0
    } = req.body || {};

    console.log("📥 Dữ liệu nhận được:", req.body);

    // Kiểm tra dữ liệu bắt buộc
    if (!code || !discount_type || value == null || !valid_until) {
      console.error("❌ Thiếu dữ liệu:", { code, discount_type, value, valid_until });
      return res.status(400).json({
        error: "Thiếu dữ liệu voucher!",
        details: { code: !!code, discount_type: !!discount_type, value: value != null, valid_until: !!valid_until }
      });
    }

    // Chuẩn hóa valid_from
    const validFrom = valid_from && String(valid_from).trim() !== ""
      ? String(valid_from).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Chuẩn hóa valid_until
    const validUntil = String(valid_until).slice(0, 10);

    const sql = `
      INSERT INTO discounts (
        code, name, description, discount_type, value,
        valid_from, valid_until, status, usage_limit, usage_used,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
      RETURNING *;
    `;

    const params = [
      code.trim(),
      name || null,
      description || null,
      discount_type,
      Number(value),
      validFrom,
      validUntil,
      status,
      Number(usage_limit) || 0
    ];

    console.log("📤 SQL params:", params);

    const { rows } = await pool.query(sql, params);
    console.log("✅ Thêm voucher thành công:", rows[0]);

    return res.status(201).json({
      message: "Thêm voucher thành công",
      data: rows[0]
    });
  } catch (err) {
    console.error("❌ Lỗi thêm voucher:", err);
    return res.status(500).json({
      error: "Lỗi server khi thêm voucher",
      details: err.message
    });
  }
});

// Cập nhật voucher
app.put("/api/discounts/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      discount_type,
      value,
      valid_from,
      valid_until,
      status,
      usage_limit
    } = req.body;

    console.log("📥 Cập nhật voucher:", { id, ...req.body });

    const sql = `
      UPDATE discounts
      SET code=$1, name=$2, description=$3, discount_type=$4, value=$5, 
          valid_from=$6, valid_until=$7, status=$8, usage_limit=$9, updated_at=NOW()
      WHERE id=$10
      RETURNING *;
    `;

    const params = [
      code,
      name,
      description,
      discount_type,
      Number(value),
      valid_from,
      valid_until,
      status,
      Number(usage_limit) || 0,
      id
    ];

    const { rows } = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy voucher" });
    }

    console.log("✅ Cập nhật thành công:", rows[0]);
    res.json({ message: "Cập nhật voucher thành công", data: rows[0] });
  } catch (err) {
    console.error("❌ Lỗi cập nhật voucher:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật voucher", details: err.message });
  }
});

// Xóa voucher
app.delete("/api/discounts/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Xóa voucher:", id);

    const result = await pool.query("DELETE FROM discounts WHERE id=$1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy voucher" });
    }

    console.log("✅ Xóa thành công:", result.rows[0]);
    res.json({ message: "Xóa voucher thành công" });
  } catch (err) {
    console.error("❌ Lỗi xóa voucher:", err);
    res.status(500).json({ error: "Lỗi khi xóa voucher", details: err.message });
  }
});


// ===== KHỞI CHẠY SERVER =====
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});

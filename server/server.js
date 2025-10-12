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
app.use(cors());
app.use(express.json());

// Xác định __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== UPLOADS CONFIG =====

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve upload folder
app.use("/uploads", express.static(UPLOAD_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ chấp nhận file ảnh"));
    }
    cb(null, true);
  },
});

// Middleware xử lý form-data
app.use((req, res, next) => {
  if (req.headers["content-type"]?.includes("multipart/form-data")) {
    upload.array("images")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      } // Parse JSON data nếu có
      if (req.body?.data) {
        try {
          req.body = { ...req.body, ...JSON.parse(req.body.data) };
        } catch (e) {
          console.warn("Lỗi parse JSON data:", e);
        }
      }
      next();
    });
  } else {
    next();
  }
});

// ===== SERVE STATIC =====

// Serve frontend User (thư mục public)
app.use("/", express.static(path.join(__dirname, "../public")));

// Serve frontend Admin (thư mục admin/public)
app.use("/admin", express.static(path.join(__dirname, "../admin/public")));

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
app.post("/auth/register", async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users(email, password_hash, full_name, phone) VALUES($1, $2, $3, $4) RETURNING id, role",
      [email, hash, full_name || null, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT id, password_hash, role FROM users WHERE email=$1",
      [email]
    );

    if (
      rows.length === 0 ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
    }

    const token = jwt.sign(
      { userId: rows[0].id, role: rows[0].role },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "8h" }
    );
    res.json({ token });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// ===== HOTEL MANAGEMENT APIs =====
// Giữ nguyên các API quản lý khách sạn...

// ===== ROOM APIs =====

// API lấy danh sách phòng cho khách (Đã sửa sang single-line)
app.get("/api/rooms", async (req, res) => {
  try {
    const queryText =
      "SELECT r.id, r.room_number, r.room_type_id, rt.name AS room_type, rt.price_per_night, rt.capacity, rd.images_url as images, rd.description, rd.features FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id LEFT JOIN room_details rd ON rd.room_id = r.id ORDER BY r.room_number";
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách phòng:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
  }
});

// API lấy danh sách loại phòng (Đã sửa sang single-line)
app.get("/api/admin/room-types", async (req, res) => {
  try {
    const queryText =
      "SELECT id, name, price_per_night, capacity FROM room_types WHERE is_active = true ORDER BY price_per_night";
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách loại phòng:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách loại phòng" });
  }
});

// API lấy danh sách phòng cho admin (ĐÃ SỬA sang single-line)
app.get("/api/admin/rooms", async (req, res) => {
  try {
    const queryText =
      "SELECT r.id, r.room_number, r.room_type_id, rt.id AS room_type_id, rt.name AS room_type, rt.price_per_night, rd.description, rd.features, rd.images_url as images, r.status, r.category, r.location, r.address FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id LEFT JOIN room_details rd ON rd.room_id = r.id ORDER BY r.created_at DESC";
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách phòng:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
  }
});

// API thêm phòng mới (Giữ nguyên Template Literal nhưng đã có .trim() ở code trước, nên vẫn nên giữ)
app.post("/api/admin/rooms", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      room_number,
      room_type_id,
      category,
      status,
      location,
      address,
      description,
      features,
    } = req.body;

    if (!room_type_id) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin loại phòng (room_type_id)" });
    }

    await client.query("BEGIN"); // Thêm phòng mới
    const roomResult = await client.query(
      `INSERT INTO rooms (room_number, room_type_id, category, status, location, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
      `,
      [
        room_number || null,
        room_type_id,
        category || "standard",
        status || "available",
        location || "ha-noi",
        address || null,
      ]
    ); // Xử lý ảnh và chi tiết phòng
    const images = (req.files || []).map((f) => `/uploads/${f.filename}`); // Chuyển features thành mảng
    let featuresArray = features;
    if (features && !Array.isArray(features)) {
      try {
        featuresArray = JSON.parse(features);
      } catch (e) {
        featuresArray = [features];
      }
    } // Thêm chi tiết phòng
    await client.query(
      `INSERT INTO room_details (room_id, description, features, images_url)
       VALUES ($1, $2, $3, $4)
      `,
      [roomResult.rows[0].id, description || null, featuresArray, images]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...roomResult.rows[0],
      images,
      description,
      features: featuresArray,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi khi thêm phòng:", error);
    res.status(500).json({ error: "Lỗi khi thêm phòng: " + error.message });
  } finally {
    client.release();
  }
});

// API cập nhật phòng
app.put("/api/admin/rooms/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      room_number,
      room_type_id,
      category,
      status,
      location,
      address,
      description,
      features,
      existingImages,
    } = req.body;

    await client.query("BEGIN"); // Xử lý ảnh mới và cũ
    const newImages = (req.files || []).map((f) => `/uploads/${f.filename}`);

    const keepImages = existingImages
      ? Array.isArray(existingImages)
        ? existingImages
        : JSON.parse(existingImages)
      : [];

    const finalImages = [...keepImages, ...newImages]; // Chuyển features thành mảng
    let featuresArray = features;
    if (features && !Array.isArray(features)) {
      try {
        featuresArray = JSON.parse(features);
      } catch (e) {
        featuresArray = [features];
      }
    } // Cập nhật thông tin phòng
    const roomResult = await client.query(
      `UPDATE rooms
       SET room_number=$1, room_type_id=$2, category=$3, status=$4,
           location=$5, address=$6, updated_at=NOW()
       WHERE id=$7
       RETURNING *
      `,
      [
        room_number,
        room_type_id,
        category || "standard",
        status || "available",
        location || "ha-noi",
        address || null,
        id,
      ]
    );

    if (roomResult.rowCount === 0) {
      throw new Error("Không tìm thấy phòng");
    } // Cập nhật chi tiết phòng
    await client.query(
      `INSERT INTO room_details (room_id, description, features, images_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_id)
       DO UPDATE SET description=$2, features=$3, images_url=$4
      `,
      [id, description || null, featuresArray, finalImages]
    );

    await client.query("COMMIT");

    res.json({
      ...roomResult.rows[0],
      images: finalImages,
      description,
      features: featuresArray,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi khi cập nhật phòng:", error);
    res.status(500).json({ error: "Lỗi khi cập nhật phòng: " + error.message });
  } finally {
    client.release();
  }
});

// API xóa phòng
app.delete("/api/admin/rooms/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN"); // Lấy danh sách ảnh để xóa
    const detailsResult = await client.query(
      "SELECT images_url FROM room_details WHERE room_id=$1",
      [id]
    );

    const images = detailsResult.rows[0]?.images_url || []; // Xóa dữ liệu từ database
    await client.query("DELETE FROM room_details WHERE room_id=$1", [id]);

    const result = await client.query("DELETE FROM rooms WHERE id=$1", [id]);

    if (result.rowCount === 0) {
      throw new Error("Không tìm thấy phòng");
    }

    await client.query("COMMIT"); // Xóa files ảnh
    for (const url of images) {
      try {
        const filename = path.basename(url);
        const filepath = path.join(UPLOAD_DIR, filename);

        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (e) {
        console.warn(`Không thể xóa file: ${e.message}`);
      }
    }

    res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi khi xóa phòng:", error);
    res.status(500).json({ error: "Lỗi khi xóa phòng: " + error.message });
  } finally {
    client.release();
  }
});

// ===== KHỞI ĐỘNG SERVER =====

const PORT = process.env.PORT || 5500;

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});

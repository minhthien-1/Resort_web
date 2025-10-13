// server.js

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

// ===== INITIAL SETUP =====

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// __dirname setup for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== UPLOADS CONFIG =====

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

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

app.use("/", express.static(path.join(__dirname, "../public")));
app.use("/admin", express.static(path.join(__dirname, "../admin/public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});
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

// ===== AUTH MIDDLEWARE =====

function authorize(allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
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

// ===== AUTH ROUTES =====

// Register (default role = guest)
app.post("/auth/register", async (req, res) => {
  const { fullName, username, email, phone, password, role } = req.body;
  if (!fullName || !username || !email || !phone || !password) {
    return res.status(400).json({ error: "Thiếu thông tin đăng ký" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
         VALUES ($1,$2,$3,$4,$5, $6, true)`,
      [username, email, hashedPassword, fullName, phone, role || "guest"]
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

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT id, email, username, password_hash, role, full_name FROM users WHERE email=$1 AND is_active=true",
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Tài khoản không tồn tại hoặc bị khóa" });
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
    console.error("❌ Lỗi đăng nhập chi tiết:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// ===== HOTEL MANAGEMENT & ROOM APIS =====

// List rooms (public)
app.get("/api/rooms", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.room_number, r.room_type_id, rt.name AS room_type,
              rt.price_per_night, rt.capacity, rd.images_url AS images,
              rd.description, rd.features
       FROM rooms r
       JOIN room_types rt ON r.room_type_id = rt.id
       LEFT JOIN room_details rd ON rd.room_id = r.id
       ORDER BY r.room_number`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách phòng:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
  }
});

// Admin: list room types
app.get(
  "/api/admin/room-types",
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, price_per_night, capacity
         FROM room_types WHERE is_active = true
         ORDER BY price_per_night`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("❌ Lỗi khi lấy loại phòng:", error);
      res.status(500).json({ error: "Lỗi khi lấy loại phòng" });
    }
  }
);

// Admin: list rooms
app.get(
  "/api/admin/rooms",
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT r.id, r.room_number, rt.name AS room_type,
                rt.price_per_night, rd.description, rd.features,
                rd.images_url AS images, r.status, r.category,
                r.location, r.address
         FROM rooms r
         JOIN room_types rt ON r.room_type_id = rt.id
         LEFT JOIN room_details rd ON rd.room_id = r.id
         ORDER BY r.created_at DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("❌ Lỗi khi lấy danh sách phòng admin:", error);
      res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
    }
  }
);

// Admin: add room
app.post(
  "/api/admin/rooms",
  authorize(["admin", "staff"]),
  async (req, res) => {
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

      await client.query("BEGIN");
      const roomResult = await client.query(
        `INSERT INTO rooms
           (room_number, room_type_id, category, status, location, address)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          room_number || null,
          room_type_id,
          category || "standard",
          status || "available",
          location || "ha-noi",
          address || null,
        ]
      );

      const images = (req.files || []).map((f) => `/uploads/${f.filename}`);
      let featuresArray = features;
      if (features && !Array.isArray(features)) {
        try {
          featuresArray = JSON.parse(features);
        } catch {
          featuresArray = [features];
        }
      }

      await client.query(
        `INSERT INTO room_details
           (room_id, description, features, images_url)
         VALUES ($1,$2,$3,$4)`,
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
  }
);

// Admin: update room
app.put(
  "/api/admin/rooms/:id",
  authorize(["admin", "staff"]),
  async (req, res) => {
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

      await client.query("BEGIN");
      const newImages = (req.files || []).map((f) => `/uploads/${f.filename}`);
      const keepImages = existingImages
        ? Array.isArray(existingImages)
          ? existingImages
          : JSON.parse(existingImages)
        : [];
      const finalImages = [...keepImages, ...newImages];

      let featuresArray = features;
      if (features && !Array.isArray(features)) {
        try {
          featuresArray = JSON.parse(features);
        } catch {
          featuresArray = [features];
        }
      }

      const roomResult = await client.query(
        `UPDATE rooms
           SET room_number=$1, room_type_id=$2, category=$3,
               status=$4, location=$5, address=$6, updated_at=NOW()
           WHERE id=$7
           RETURNING *`,
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
      }

      await client.query(
        `INSERT INTO room_details
           (room_id, description, features, images_url)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (room_id)
         DO UPDATE SET description=$2, features=$3, images_url=$4`,
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
  }
);

// Admin: delete room
app.delete(
  "/api/admin/rooms/:id",
  authorize(["admin", "staff"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      await client.query("BEGIN");

      const detailsResult = await client.query(
        "SELECT images_url FROM room_details WHERE room_id=$1",
        [id]
      );
      const images = detailsResult.rows[0]?.images_url || [];

      await client.query("DELETE FROM room_details WHERE room_id=$1", [id]);
      const result = await client.query("DELETE FROM rooms WHERE id=$1", [id]);
      if (result.rowCount === 0) {
        throw new Error("Không tìm thấy phòng");
      }

      await client.query("COMMIT");

      for (const url of images) {
        const filename = path.basename(url);
        const filepath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }

      res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Lỗi khi xóa phòng:", error);
      res.status(500).json({ error: "Lỗi khi xóa phòng: " + error.message });
    } finally {
      client.release();
    }
  }
);

// ===== START SERVER =====

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});

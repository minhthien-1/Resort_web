import dotenv from "dotenv";
import express from "express";
import path from "path";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import pg from "pg";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query("SELECT NOW()", (err, result) => {
  if (err) {
    console.error("❌ Lỗi kết nối database:", err.message);
  } else {
    console.log("✅ Kết nối Neon database thành công!");
  }
});

const app = express();
app.use(cors({
  origin: "http://localhost:5500",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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



app.use(express.static(path.join(__dirname, "../public")));
app.use("/admin", express.static(path.join(__dirname, "../admin/public")));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    if (err.code === "23505") {
      res.status(400).json({ error: "Email hoặc Username đã tồn tại" });
    } else {
      console.error("❌ Lỗi đăng ký:", err);
      res.status(500).json({ error: "Lỗi server khi đăng ký" });
    }
  }
});

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
    const validPassword = user.password_hash.startsWith("$2b$")
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;
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
  id: user.id,  // ⭐ Thêm dòng này
  username: user.username,
  full_name: user.full_name,
  role: user.role,
});
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

app.get("/api/bookings/total", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*) AS total FROM bookings");
    res.json({ total: Number(r.rows[0].total) });
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/revenue/total", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS total_revenue FROM bookings WHERE status = 'confirmed'"
    );
    res.json({ total_revenue: Number(result.rows[0].total_revenue) });
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/revenue/current-month", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS monthly_revenue FROM bookings
       WHERE status = 'confirmed' AND EXTRACT(MONTH FROM check_in) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM check_in) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    res.json({ monthly_revenue: Number(rows[0].monthly_revenue) });
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/guests", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, created_at FROM users WHERE role='guest' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/guests/new", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS new_guests FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/customers", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, created_at FROM users WHERE role='guest' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/customers/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, phone, created_at FROM users WHERE id=$1 AND role='guest'",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/revenue/monthly", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', check_in), 'YYYY-MM') AS month,
              COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM bookings WHERE status = 'confirmed' GROUP BY 1 ORDER BY 1`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/rooms", async (req, res) => {
  try {
    const { location, room_type } = req.query;
    let sql = `SELECT r.id, r.resort_name, r.room_type_id, rt.name AS room_type, rt.price_per_night,
                      rt.capacity, rd.images_url AS images, r.location, rd.description, rd.features
               FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
               LEFT JOIN room_details rd ON rd.room_id = r.id WHERE 1=1`;
    const params = [];
    if (location) {
      params.push(`%${location}%`);
      sql += ` AND LOWER(r.location) LIKE LOWER($${params.length})`;
    }
    if (room_type) {
      params.push(room_type);
      sql += ` AND rt.name = $${params.length}`;
    }
    sql += " ORDER BY r.created_at DESC";
    const roomsResult = await pool.query(sql, params);
    res.json(roomsResult.rows);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/rooms/top-booked", async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const result = await pool.query(
      `SELECT r.id, r.category, r.location, COUNT(b.id) AS booking_count,
              COALESCE(SUM(b.total_amount), 0)::BIGINT AS total_revenue
       FROM rooms r LEFT JOIN bookings b ON b.room_id = r.id AND b.status = 'confirmed'
       GROUP BY r.id, r.category, r.location ORDER BY booking_count DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, r.resort_name, r.location, r.category, rt.name AS room_type,
              rt.price_per_night, rt.capacity, COALESCE(rd.description, 'Chưa có mô tả') AS description,
              COALESCE(rd.features, ARRAY['Không có thông tin']) AS features,
              COALESCE(rd.images_url, ARRAY[]::text[]) AS images
       FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
       LEFT JOIN room_details rd ON rd.room_id = r.id WHERE r.id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy phòng" });
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const { room_id, rating, comment, username } = req.body;
    if (!room_id || !rating || !comment || !username) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    const { rows } = await pool.query(
      `INSERT INTO reviews (room_id, rating, comment, username) VALUES ($1, $2, $3, $4)
       RETURNING review_id, created_at`,
      [room_id, rating, comment, username]
    );
    res.status(201).json({
      message: "Đánh giá đã được gửi thành công!",
      review_id: rows[0].review_id,
      created_at: rows[0].created_at,
    });
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/reviews/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { rows } = await pool.query(
      `SELECT review_id, room_id, rating, comment, username, created_at FROM reviews
       WHERE room_id = $1 ORDER BY created_at DESC`,
      [roomId]
    );
    res.json(rows);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/room-types", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, price_per_night, capacity FROM room_types WHERE is_active = true ORDER BY price_per_night"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/room-types", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT name FROM room_types WHERE is_active = true ORDER BY name"
    );
    const types = result.rows.map((r) => r.name);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/rooms", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.resort_name, rt.name AS room_type, rt.price_per_night, rd.description,
              rd.features, rd.images_url AS images, r.status, r.category, r.location, r.address
       FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
       LEFT JOIN room_details rd ON rd.room_id = r.id ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ✅ THÊM ENDPOINT NÀY: GET chi tiết 1 room
app.get("/api/admin/rooms/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, r.resort_name, r.room_type_id, rt.name AS room_type, rt.price_per_night,
              r.status, r.category, r.location, r.address, rd.description, rd.features,
              rd.images_url AS images
       FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
       LEFT JOIN room_details rd ON rd.room_id = r.id WHERE r.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy phòng" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ✅ SỬA: POST tạo room mới
app.post("/api/admin/rooms", authorize(["admin", "staff"]), (req, res) => {
  upload.array("images")(req, res, async (err) => {
    if (err) {
      console.error("Upload error:", err.message);
      return res.status(400).json({ error: "Lỗi upload: " + err.message });
    }

    try {
      const { resort_name, room_type_id, status, category, location, address } = req.body;
      
      console.log("POST Body:", { resort_name, room_type_id, status, category, location, address });
      console.log("Files count:", req.files?.length || 0);

      if (!resort_name || !room_type_id || !location) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
      }

      // ✅ Lấy tên file ảnh
      const imageNames = (req.files && req.files.length > 0) 
        ? req.files.map(f => f.filename) 
        : [];

      console.log("Image names:", imageNames);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const roomResult = await client.query(
          `INSERT INTO rooms (resort_name, room_type_id, status, category, location, address, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [resort_name, room_type_id, status || "active", category || "", location, address || ""]
        );

        const roomId = roomResult.rows[0].id;
        console.log("Room created:", roomId);

        // ✅ INSERT room_details với ảnh
        const detailResult = await client.query(
          `INSERT INTO room_details (room_id, description, features, images_url, created_at)
           VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
          [roomId, "", [], imageNames]
        );

        console.log("Room details inserted:", detailResult.rows[0]);

        await client.query("COMMIT");
        res.status(201).json({ 
          message: "Thêm phòng thành công", 
          room_id: roomId,
          images: imageNames
        });
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("DB Error:", dbErr);
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("❌ POST Error:", err);
      res.status(500).json({ error: "Lỗi server", details: err.message });
    }
  });
});

// ✅ SỬA: PUT cập nhật room
app.put("/api/admin/rooms/:id", authorize(["admin", "staff"]), (req, res) => {
  upload.array("images")(req, res, async (err) => {
    if (err) {
      console.error("Upload error:", err.message);
      return res.status(400).json({ error: "Lỗi upload: " + err.message });
    }

    try {
      const { id } = req.params;
      const { resort_name, room_type_id, status, category, location, address } = req.body;

      console.log("PUT ID:", id);
      console.log("PUT Body:", { resort_name, room_type_id });
      console.log("Files count:", req.files?.length || 0);

      const imageNames = (req.files && req.files.length > 0) 
        ? req.files.map(f => f.filename) 
        : [];

      console.log("Image names to save:", imageNames);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const updateResult = await client.query(
          `UPDATE rooms SET resort_name=$1, room_type_id=$2, status=$3, category=$4, location=$5, address=$6, updated_at=NOW()
           WHERE id=$7 RETURNING id`,
          [resort_name, room_type_id, status, category, location, address, id]
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Không tìm thấy phòng" });
        }

        console.log("Room updated");

        // ✅ Kiểm tra room_details
        const existingDetail = await client.query("SELECT id FROM room_details WHERE room_id=$1", [id]);
        
        if (existingDetail.rows.length > 0) {
          // Cập nhật nếu có ảnh mới
          if (imageNames.length > 0) {
            await client.query(
              `UPDATE room_details SET images_url=$1, updated_at=NOW() WHERE room_id=$2`,
              [imageNames, id]
            );
            console.log("Room details updated with images:", imageNames);
          }
        } else {
          // Tạo mới nếu chưa có
          if (imageNames.length > 0) {
            await client.query(
              `INSERT INTO room_details (room_id, description, features, images_url, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [id, "", [], imageNames]
            );
            console.log("Room details created with images:", imageNames);
          }
        }

        await client.query("COMMIT");
        res.json({ message: "Cập nhật phòng thành công" });
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("DB Error:", dbErr);
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("❌ PUT Error:", err);
      res.status(500).json({ error: "Lỗi server", details: err.message });
    }
  });
});



app.get("/api/discounts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, description, discount_type, value, valid_from, valid_until, status,
              usage_limit, usage_used FROM discounts ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ error: "Lỗi server", details: error.message });
  }
});



app.post("/api/discounts", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { code = "", name = "", description = "", discount_type = "percent", value = null,
            valid_from, valid_until, status = "active", usage_limit = 0 } = req.body || {};
    if (!code || !discount_type || value == null || !valid_until) {
      return res.status(400).json({ error: "Thiếu dữ liệu voucher!" });
    }
    const validFrom = valid_from && String(valid_from).trim() !== "" 
      ? String(valid_from).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const validUntil = String(valid_until).slice(0, 10);
    const { rows } = await pool.query(
      `INSERT INTO discounts (code, name, description, discount_type, value, valid_from, valid_until,
                              status, usage_limit, usage_used, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW()) RETURNING *`,
      [code.trim(), name || null, description || null, discount_type, Number(value),
       validFrom, validUntil, status, Number(usage_limit) || 0]
    );
    res.status(201).json({ message: "Thêm voucher thành công", data: rows[0] });
  } catch (err) {
    console.error("❌ Lỗi:", err);
    res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

app.put("/api/discounts/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, discount_type, value, valid_from, valid_until, status, usage_limit } = req.body;
    const { rows } = await pool.query(
      `UPDATE discounts SET code=$1, name=$2, description=$3, discount_type=$4, value=$5,
                           valid_from=$6, valid_until=$7, status=$8, usage_limit=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [code, name, description, discount_type, Number(value), valid_from, valid_until, status, Number(usage_limit) || 0, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Không tìm thấy voucher" });
    res.json({ message: "Cập nhật voucher thành công", data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

app.delete("/api/discounts/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM discounts WHERE id=$1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy voucher" });
    res.json({ message: "Xóa voucher thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

app.get("/api/revenue/filter", async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = "SELECT COALESCE(SUM(total_amount), 0)::BIGINT AS total_revenue FROM bookings WHERE status = 'confirmed'";
    const params = [];
    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM check_in) = $1 AND EXTRACT(YEAR FROM check_in) = $2`;
      params.push(parseInt(month), parseInt(year));
    }
    const result = await pool.query(query, params);
    res.json({ total_revenue: Number(result.rows[0].total_revenue) });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/bookings/filter", async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = "SELECT COUNT(*) AS total FROM bookings WHERE 1=1";
    const params = [];
    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM check_in) = $1 AND EXTRACT(YEAR FROM check_in) = $2`;
      params.push(parseInt(month), parseInt(year));
    }
    const result = await pool.query(query, params);
    res.json({ total: Number(result.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});

import express from "express";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authRouter from './Routes/auth.js';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});


const app = express();
app.use('/api/auth', authRouter);  // ← Thêm route
app.use(cors({
  origin: "http://localhost:5500",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
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

// Hàm xóa file ảnh
const deleteFile = (filename) => {
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✅ Đã xóa file: ${filename}`);
  }
};

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
      "SELECT id, email, username, password_hash, role, full_name, phone FROM users WHERE email=$1 AND is_active=true",
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
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
      email: user.email
    });
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

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

// API 2: Tổng doanh thu toàn hệ thống
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

// API 3: Doanh thu tháng hiện tại
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

// ===== API QUẢN LÝ RESORTS =====
app.get("/api/admin/resorts", authorize(['admin', 'staff']), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM resorts ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách resort" });
  }
});

app.post("/api/admin/resorts", authorize(['admin', 'staff']), async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "Tên resort là bắt buộc" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO resorts (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: "Tên resort này đã tồn tại." });
    }
    res.status(500).json({ error: "Lỗi server khi tạo resort" });
  }
});

// ===== API QUẢN LÝ PHÒNG =====
app.get("/api/rooms", async (req, res) => {
  try {
    const { location, room_type } = req.query;
    let sql = `SELECT r.id, res.name AS resort_name, r.room_type_id, rt.name AS room_type, 
                      rd.price_per_night,
                      rt.capacity, rd.images_url AS images, r.location, rd.description, rd.features, rd.num_bed
               FROM rooms r 
               JOIN room_types rt ON r.room_type_id = rt.id
               JOIN resorts res ON r.resort_id = res.id
               LEFT JOIN room_details rd ON rd.room_id = r.id 
               WHERE 1=1`;
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

// ✅ GET chi tiết phòng (FIX COALESCE TYPES)
app.get("/api/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, res.name AS resort_name, r.location, r.category, r.address,
               rt.name AS room_type, rt.capacity, 
               COALESCE(rd.description, 'Chưa có mô tả') AS description,
               
               -- ✅ FIX: Cast array về text hoặc lấy dạng JSON
               COALESCE(rd.features::text, '[]'::text) AS features,
               COALESCE(rd.images_url::text, '[]'::text) AS images,
               
               rd.price_per_night,
               rd.num_bed
       FROM rooms r 
       JOIN room_types rt ON r.room_type_id = rt.id
       JOIN resorts res ON r.resort_id = res.id
       LEFT JOIN room_details rd ON rd.room_id = r.id 
       WHERE r.id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy phòng" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết phòng:", error);
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
      "SELECT id, name, capacity FROM room_types WHERE is_active = true ORDER BY name"
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

// ✅ GET danh sách phòng admin (với room_type_id)
app.get("/api/admin/rooms", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          r.id, 
          res.name as resort_name,
          r.resort_id,
          r.room_type_id,
          rt.name AS room_type, 
          rd.price_per_night,
          rd.description, 
          rd.features, 
          rd.images_url AS images,
          r.status, 
          r.category, 
          r.location, 
          r.address, 
          rd.num_bed
       FROM rooms r 
       JOIN room_types rt ON r.room_type_id = rt.id
       JOIN resorts res ON r.resort_id = res.id
       LEFT JOIN room_details rd ON rd.room_id = r.id 
       ORDER BY res.name, r.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng admin:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.get("/api/admin/rooms/:id", authorize(["admin", "staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, r.resort_id, r.room_type_id, rt.name AS room_type,
              r.status, r.category, r.location, r.address, rd.description, rd.features,
              rd.images_url AS images, rd.num_bed, rd.price_per_night
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

// ✅ POST tạo phòng mới (LƯU GIÁ VÀO room_details)
app.post("/api/admin/rooms", authorize(["admin", "staff"]), upload.array('images'), async (req, res) => {
  try {
    const { resort_id, room_type_id, status, category, location, address, description, num_bed, price_per_night } = req.body;

    if (!resort_id || !room_type_id) {
      return res.status(400).json({ error: "Thiếu thông tin Resort ID hoặc Loại phòng" });
    }
    
    const imageNames = (req.files && req.files.length > 0) ? req.files.map(f => f.filename) : [];
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      const roomResult = await client.query(
        `INSERT INTO rooms (resort_id, room_type_id, status, category, location, address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [resort_id, room_type_id, status || "available", category || "standard", location, address || ""]
      );
      const roomId = roomResult.rows[0].id;

      // ✅ LƯU GIÁ VÀO room_details
      await client.query(
        `INSERT INTO room_details (room_id, description, features, images_url, num_bed, price_per_night, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [roomId, description || "", [], imageNames, num_bed || '', parseFloat(price_per_night) || 0]
      );

      await client.query("COMMIT");
      res.status(201).json({ message: "Thêm phòng thành công" });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      // 📍 Xóa ảnh đã tải lên nếu lỗi DB
      if (imageNames.length > 0) {
        imageNames.forEach(imageName => deleteFile(imageName));
      }
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ POST Error:", err);
    res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

// ✅ PUT cập nhật phòng (Tự động xóa ảnh cũ khi có ảnh mới)
app.put("/api/admin/rooms/:id", authorize(["admin", "staff"]), upload.array('images'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resort_id, room_type_id, status, category, location, address, description, num_bed, price_per_night } = req.body;
    
    // 1. Lấy danh sách tên file MỚI (nếu có)
    const newImageNames = (req.files && req.files.length > 0) ? req.files.map(f => f.filename) : [];
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 📍 LOGIC XÓA ẢNH CŨ
      if (newImageNames.length > 0) {
        const oldDetailResult = await client.query(
          "SELECT images_url FROM room_details WHERE room_id = $1",
          [id]
        );
        const oldImages = oldDetailResult.rows[0]?.images_url || [];
        if (Array.isArray(oldImages) && oldImages.length > 0) {
          oldImages.forEach(imageName => deleteFile(imageName));
        }
      }

      // 2. Cập nhật bảng 'rooms'
      const updateResult = await client.query(
        `UPDATE rooms SET 
           resort_id=$1, room_type_id=$2, status=$3, category=$4, 
           location=$5, address=$6, updated_at=NOW()
         WHERE id=$7 RETURNING id`,
        [resort_id, room_type_id, status, category, location, address, id]
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Không tìm thấy phòng" });
      }

      // 3. Cập nhật/Thêm mới bảng 'room_details'
      const existingDetail = await client.query("SELECT id FROM room_details WHERE room_id=$1", [id]);
      
      if (existingDetail.rows.length > 0) {
        // Cập nhật
        const updateImages = newImageNames.length > 0 ? newImageNames : null;
        await client.query(
          `UPDATE room_details SET 
             description=$1, features=$2, num_bed=$3, price_per_night=$4, 
             updated_at=NOW() ${updateImages ? ', images_url=$5' : ''}
           WHERE room_id=$${updateImages ? '6' : '5'}`,
          updateImages 
            ? [description || "", [], num_bed || '', parseFloat(price_per_night) || 0, updateImages, id]
            : [description || "", [], num_bed || '', parseFloat(price_per_night) || 0, id]
        );
      } else {
        // Thêm mới
        await client.query(
          `INSERT INTO room_details (room_id, description, features, images_url, num_bed, price_per_night, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [id, description || "", [], newImageNames, num_bed || '', parseFloat(price_per_night) || 0]
        );
      }

      await client.query("COMMIT");
      res.json({ message: "Cập nhật phòng thành công" });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      // Nếu lỗi DB, xóa file VỪA MỚI UPLOAD
      if (newImageNames.length > 0) {
        newImageNames.forEach(imageName => deleteFile(imageName));
      }
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ PUT Error:", err);
    res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

// ===== API XÓA PHÒNG (Tự động xóa file ảnh liên quan) =====
app.delete("/api/admin/rooms/:id", authorize(['admin', 'staff']), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect(); 

  try {
    await client.query('BEGIN');

    // 1. Kiểm tra booking
    const bookingCheck = await client.query(
      'SELECT id FROM bookings WHERE room_id = $1 LIMIT 1', 
      [id]
    );

    if (bookingCheck.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: "Không thể xóa phòng này vì đã có khách đặt. Hãy xem xét chuyển trạng thái phòng sang bảo trì." 
      });
    }

    // 2. 📍 LẤY DANH SÁCH ẢNH CẦN XÓA
    const detailResult = await client.query(
        "SELECT images_url FROM room_details WHERE room_id = $1",
        [id]
    );
    const imagesToDelete = detailResult.rows[0]?.images_url || [];

    // 3. Xóa phòng (Giả sử DB có 'ON DELETE CASCADE')
    const deleteResult = await client.query(
      'DELETE FROM rooms WHERE id = $1 RETURNING id', 
      [id]
    );

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Không tìm thấy phòng để xóa." });
    }

    // 4. Commit DB
    await client.query('COMMIT');

    // 5. 📍 XÓA FILE (làm sau khi commit thành công)
    if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
      console.log(`[DELETE /rooms/${id}] Đã xóa phòng khỏi DB, đang xóa ${imagesToDelete.length} file...`);
      imagesToDelete.forEach(imageName => deleteFile(imageName));
    }
    
    res.status(200).json({ 
      message: "Xóa phòng (và các ảnh liên quan) thành công!", 
      deletedRoomId: deleteResult.rows[0].id 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Lỗi khi xóa phòng:", error);
    res.status(500).json({ error: "Lỗi server khi xóa phòng." });
  } finally {
    client.release(); 
  }
});

// ===== BOOKING API =====
app.post("/api/bookings", authorize(['guest', 'staff', 'admin']), async (req, res) => {
  const { userId } = req.user;
  const { roomId, checkIn, checkOut, pricePerNight } = req.body;

  if (!userId || !roomId || !checkIn || !checkOut || !pricePerNight) {
    return res.status(400).json({ error: "Thiếu thông tin đặt phòng." });
  }

  try {
    const parseDate = (str) => { const [day, month, year] = str.split('/'); return `${year}-${month}-${day}`; };
    const startDate = new Date(parseDate(checkIn));
    const endDate = new Date(parseDate(checkOut));
    const timeDiff = endDate.getTime() - startDate.getTime();
    const nights = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    const totalAmount = nights * pricePerNight;

    const sql = `
      INSERT INTO bookings (user_id, room_id, check_in, check_out, nightly_rate, total_amount, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, booking_code, total_amount;
    `;
    
    const params = [userId, roomId, parseDate(checkIn), parseDate(checkOut), pricePerNight, totalAmount];
    
    const { rows } = await pool.query(sql, params);
    res.status(201).json({
      message: "Đặt phòng thành công!",
      booking: rows[0]
    });

  } catch (error) {
    console.error("❌ Lỗi khi tạo booking:", error);
    res.status(500).json({ error: "Lỗi server khi tạo đơn đặt phòng." });
  }
});

// ===== API LẤY LỊCH SỬ ĐẶT PHÒNG =====
app.get("/api/my-bookings", authorize(['guest']), async (req, res) => {
  const { userId } = req.user;

  try {
    const sql = `
      SELECT 
        b.id,
        b.booking_code,
        b.check_in,
        b.check_out,
        b.total_amount,
        b.status,
        res.name AS resort_name,
        rd.images_url
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN resorts res ON r.resort_id = res.id
      LEFT JOIN room_details rd ON r.id = rd.room_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await pool.query(sql, [userId]);
    res.status(200).json(rows);

  } catch (error) {
    console.error("❌ Lỗi khi lấy lịch sử đặt phòng:", error);
    res.status(500).json({ error: "Lỗi server khi lấy lịch sử đặt phòng." });
  }
});

// ===== API HỦY ĐẶT PHÒNG =====
app.put("/api/bookings/:id/cancel", authorize(['guest']), async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    const sql = `
      UPDATE bookings
      SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND (status = 'pending' OR status = 'confirmed')
      RETURNING id, status;
    `;

    const { rows, rowCount } = await pool.query(sql, [id, userId]);

    if (rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy đặt phòng hoặc không thể hủy." });
    }

    res.status(200).json({
      message: "Hủy đặt phòng thành công!",
      booking: rows[0]
    });

  } catch (error) {
    console.error("❌ Lỗi khi hủy đặt phòng:", error);
    res.status(500).json({ error: "Lỗi server khi hủy đặt phòng." });
  }
});

// ===== VOUCHER API =====
app.get("/api/discounts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, description, discount_type, value, valid_from, valid_until, status,
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

// API: Tạo booking từ admin
app.post("/api/admin/bookings", async (req, res) => {
  const { emailOrUsername, fullName, phone, roomId, checkIn, checkOut, status } = req.body;

  if (!emailOrUsername || !fullName || !phone || !roomId || !checkIn || !checkOut || !status) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  try {
    // Kiểm tra user trong DB
    let userId = null;
    const { rows: userRows } = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $1 LIMIT 1",
      [emailOrUsername]
    );
    
    if (userRows.length > 0) {
      userId = userRows[0].id;
    } else {
      // Tạo user mới
      const defaultPassword = await bcrypt.hash(phone, 10);
      const { rows: newUserRows } = await pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, 'guest', true, NOW())
         RETURNING id`,
        [emailOrUsername, emailOrUsername, defaultPassword, fullName, phone]
      );
      userId = newUserRows[0].id;
    }

    // Kiểm tra phòng có sẵn không
    const { rows: roomRows } = await pool.query(
      "SELECT r.id, rd.price_per_night FROM rooms r LEFT JOIN room_details rd ON r.id = rd.room_id WHERE r.id = $1 AND r.status = 'available'",
      [roomId]
    );
    
    if (roomRows.length === 0) {
      return res.status(404).json({ error: 'Phòng không tồn tại hoặc đã được đặt' });
    }

    const room = roomRows[0];
    const pricePerNight = parseFloat(room.price_per_night) || 0;

    // Tính toán tổng tiền
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const nights = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    const totalAmount = nights * pricePerNight;

    const bookingCode = `ADMIN-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    // Lưu booking vào DB
    const { rows: bookingRows } = await pool.query(
      `INSERT INTO bookings (user_id, room_id, booking_code, check_in, check_out, nightly_rate, total_amount, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
       RETURNING id, booking_code, total_amount, status`,
      [userId, roomId, bookingCode, checkIn, checkOut, pricePerNight, totalAmount, status]
    );

    // Cập nhật trạng thái phòng nếu đã nhận phòng
    if (status === 'checked_in') {
      await pool.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [roomId]);
    }

    res.status(201).json({
      message: 'Đặt phòng thành công!',
      booking: bookingRows[0],
      newUser: userRows.length === 0,
      userInfo: {
        userId,
        fullName,
        phone,
        email: emailOrUsername
      }
    });
  } catch (err) {
    console.error("❌ Lỗi khi tạo booking:", err);
    res.status(500).json({ error: 'Lỗi server khi tạo đặt phòng' });
  }
});

// API: Kiểm tra xem user đã tồn tại chưa
app.get("/api/users/check", async (req, res) => {
  const { identifier } = req.query;

  if (!identifier) {
    return res.status(400).json({ error: 'Thiếu thông tin email/username' });
  }

  try {
    const sql = `
      SELECT id, email, username, full_name, phone, role, is_active
      FROM users 
      WHERE email = $1 OR username = $1
      LIMIT 1
    `;
    const result = await pool.query(sql, [identifier]);

    if (result.rows.length > 0) {
      res.json({ exists: true, user: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("❌ Lỗi kiểm tra user:", err);
    res.status(500).json({ error: "Lỗi server khi kiểm tra user" });
  }
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
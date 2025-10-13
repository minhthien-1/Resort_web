// server/routes/adminRooms.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// -----------------------------
// 🟢 GET: Danh sách loại phòng
// -----------------------------
router.get("/room-types", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, price_per_night, capacity FROM room_types WHERE is_active = TRUE ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching room types:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách loại phòng" });
  }
});

// -----------------------------
// 🟢 GET: Danh sách phòng
// -----------------------------
router.get("/rooms", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.room_number, r.status, r.room_type_id,
             rt.name AS room_type, rt.price_per_night, rt.capacity,
             'standard' AS category
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching rooms:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng" });
  }
});

// -----------------------------
// 🟢 POST: Thêm phòng mới
// -----------------------------
router.post("/rooms", async (req, res) => {
  try {
    const { room_number, room_type_id, status, category } = req.body;
    if (!room_number || !room_type_id) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    const insert = await pool.query(
      `INSERT INTO rooms (room_number, room_type_id, status)
       VALUES ($1, $2, $3) RETURNING *`,
      [room_number, room_type_id, status]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("❌ Error adding room:", err);
    res.status(500).json({ error: "Không thể thêm phòng" });
  }
});

// -----------------------------
// 🟢 PUT: Cập nhật thông tin phòng
// -----------------------------
router.put("/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, room_type_id, status } = req.body;

    const update = await pool.query(
      `UPDATE rooms 
       SET room_number=$1, room_type_id=$2, status=$3, created_at=created_at 
       WHERE id=$4 RETURNING *`,
      [room_number, room_type_id, status, id]
    );

    if (update.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy phòng" });

    res.json(update.rows[0]);
  } catch (err) {
    console.error("❌ Error updating room:", err);
    res.status(500).json({ error: "Không thể cập nhật phòng" });
  }
});

// -----------------------------
// 🟢 DELETE: Xóa phòng
// -----------------------------
router.delete("/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query("DELETE FROM rooms WHERE id=$1", [id]);
    if (del.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy phòng" });
    res.status(204).send(); // 204 = xóa thành công, không có nội dung trả về
  } catch (err) {
    console.error("❌ Error deleting room:", err);
    res.status(500).json({ error: "Không thể xóa phòng" });
  }
});

export default router;

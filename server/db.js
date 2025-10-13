import dotenv from "dotenv";
import pkg from "pg";
dotenv.config();
const { Pool } = pkg;

// Load biến môi trường từ file .env ở GỐC project
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pkg;

// ===== KẾT NỐI DATABASE =====
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // bắt buộc với Neon
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
  process.exit(-1);
});

// ===== HÀM TRUY VẤN TIỆN DỤNG =====
export const query = (text, params) => pool.query(text, params);

// Kiểm tra env (tùy chọn - có thể bật nếu cần debug)
// console.log('DATABASE_URL =', process.env.DATABASE_URL);

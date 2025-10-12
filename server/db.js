// server/db.js
import dotenv from 'dotenv';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

// ===== XÁC ĐỊNH ĐƯỜNG DẪN .env =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load biến môi trường từ file .env ở GỐC project
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pkg;

// ===== KẾT NỐI DATABASE =====
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Bắt buộc cho Neon
  },
});

// ===== LOG TRẠNG THÁI KẾT NỐI =====
pool.on('connect', () => {
  console.log('✅ Connected to Neon PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
  process.exit(-1);
});

// ===== HÀM TRUY VẤN TIỆN DỤNG =====
export const query = (text, params) => pool.query(text, params);

// Kiểm tra env (tùy chọn - có thể bật nếu cần debug)
// console.log('DATABASE_URL =', process.env.DATABASE_URL);

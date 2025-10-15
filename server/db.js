import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pkg;

// Thiết lập __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Tạo kết nối
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Hàm tiện ích query
export const query = (text, params) => pool.query(text, params);

// Bắt lỗi
pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
  process.exit(-1);
});

import dotenv from "dotenv";
import pkg from "pg";
dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // bắt buộc với Neon
});

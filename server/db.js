// server/db.js
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();           // load biến môi trường
const { Pool } = pkg;      // lấy class Pool từ pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

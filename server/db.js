// db.js
import dotenv from "dotenv";
import pkg from "pg";
import path from "path";

dotenv.config({ path: path.resolve("./.env") });

const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

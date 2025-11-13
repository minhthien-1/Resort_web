import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_SaXocHKw0A5p@ep-winter-darkness-a1ilhq1i-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("", res.rows[0].now);
  } catch (err) {
    console.error("❌ Lỗi kết nối DB:", err);
  } finally {
    await pool.end();
  }
}

testConnection();

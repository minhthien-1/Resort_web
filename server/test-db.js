import dotenv from 'dotenv';
import pkg from 'pg';
import path from 'path';

dotenv.config({ path: path.resolve('./.env') });

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Đã kết nối thành công tới database!');
    const result = await client.query('SELECT NOW()');
    console.log('Thời gian trên server DB:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Kết nối thất bại:', err.message);
  }
})();

export default pool;

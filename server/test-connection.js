import { query } from './db.js';

(async () => {
  try {
    const result = await query('SELECT NOW()');
    console.log('🕒 Database time:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Query failed:', err.message);
  }
})();

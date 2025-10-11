// ✅ Thêm dòng này để import Pool
import pg from "pg";
const { Pool } = pg;

// ✅ Kết nối NeonDB
export const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_SaXocHKw0A5p@ep-winter-darkness-a1ilhq1i-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

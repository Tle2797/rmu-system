// server/db.config.ts
import "server-only"; // ป้องกันไม่ให้ไฟล์นี้ไปโผล่ฝั่ง client
import pgPromise from "pg-promise";

// --- ประกาศ global สำหรับเก็บ instance ระหว่าง hot-reload ---
declare global {
  // eslint-disable-next-line no-var
  var __pgp: ReturnType<typeof pgPromise> | undefined;
  // eslint-disable-next-line no-var
  var __db: import("pg-promise").IDatabase<unknown> | undefined;
  // eslint-disable-next-line no-var
  var __dbReadyLogged: boolean | undefined;
}

// ใช้ instance เดิมถ้ามี (กัน duplicate)
const pgp = global.__pgp ?? pgPromise({ capSQL: true });

// แปลงพอร์ตเป็น number
const pgPort = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;

// คอนฟิกเชื่อมต่อ (Neon แนะนำ ssl: { rejectUnauthorized: false })
const connectionConfig = {
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: pgPort,
  ssl: { rejectUnauthorized: false },
} as const;

// ใช้ db เดิมถ้ามี ไม่งั้นสร้างใหม่
const db =
  global.__db ??
  pgp(connectionConfig);

// ใน dev ให้ cache instance ไว้บน global เพื่อกันการสร้างซ้ำเมื่อ hot-reload
if (process.env.NODE_ENV !== "production") {
  global.__pgp = pgp;
  global.__db = db;
}

// (ทางเลือก) log สถานะเชื่อมต่อ "ครั้งเดียว" ในช่วงอายุโปรเซส
(async () => {
  if (!global.__dbReadyLogged) {
    try {
      await db.one("select 1");
      console.log("✅ Database connected");
    } catch (err: any) {
      console.error("❌ Database connection failed:", err?.message || err);
    } finally {
      global.__dbReadyLogged = true;
    }
  }
})();

export { db, pgp };

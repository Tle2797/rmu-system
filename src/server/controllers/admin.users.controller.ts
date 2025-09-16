import { db } from "../db.config";
import bcrypt from "bcryptjs";

// ✅ list ผู้ใช้ (เลือก name มาด้วย)
export async function adminListUsers() {
  const rows = await db.any(`
    SELECT u.id, u.username, u.name, u.role_code,
           u.department_id, d.code AS department_code, d.name AS department_name,
           u.created_at
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY u.id DESC
  `);
  return rows;
}

// ✅ สร้างผู้ใช้ใหม่ (รองรับ name; ถ้าไม่ส่งมา จะใช้ username เป็นค่าแทน)
export async function adminCreateUser(body: any) {
  const username = String(body?.username || "").trim();
  const name     = String(body?.name || "").trim();
  const role_code = String(body?.role_code || "").trim().toLowerCase();
  const department_id = body?.department_id ? Number(body.department_id) : null;
  const password = String(body?.password || "");

  if (!username || !password || !role_code) return { error: "กรอกข้อมูลให้ครบ" };

  // ตรวจซ้ำ username
  const dup = await db.oneOrNone("SELECT id FROM users WHERE username = $1", [username]);
  if (dup) return { error: "มีชื่อผู้ใช้นี้อยู่แล้ว" };

  const hash = await bcrypt.hash(password, 10);
  const displayName = name || username; // 👈 กัน null ในคอลัมน์ name

  const row = await db.one(
    `INSERT INTO users (username, name, password_hash, role_code, department_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, username, name, role_code, department_id`,
    [username, displayName, hash, role_code, department_id]
  );
  return { message: "สร้างผู้ใช้สำเร็จ", user: row };
}

// ✅ อัปเดตผู้ใช้ (อัปเดต name/role/department ได้)
export async function adminUpdateUser(idParam: string, body: any) {
  const id = Number(idParam);
  if (!id) return { error: "id ไม่ถูกต้อง" };

  const name = typeof body?.name === "string" ? String(body.name).trim() : undefined;
  const role_code = body?.role_code ? String(body.role_code).toLowerCase() : undefined;
  const department_id =
    typeof body?.department_id === "number" ? body.department_id : body?.department_id === null ? null : undefined;

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (name !== undefined)         { sets.push(`name = $${i++}`); vals.push(name); }
  if (role_code !== undefined)    { sets.push(`role_code = $${i++}`); vals.push(role_code); }
  if (department_id !== undefined){ sets.push(`department_id = $${i++}`); vals.push(department_id); }

  if (!sets.length) return { error: "ไม่มีข้อมูลให้อัปเดต" };

  vals.push(id);
  const row = await db.oneOrNone(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING id, username, name, role_code, department_id`,
    vals
  );
  if (!row) return { error: "ไม่พบผู้ใช้" };
  return { message: "อัปเดตสำเร็จ", user: row };
}

// ✅ รีเซ็ตรหัสผ่าน
export async function adminResetPassword(idParam: string, body: any) {
  const id = Number(idParam);
  if (!id) return { error: "id ไม่ถูกต้อง" };
  const password = String(body?.password || "");
  if (!password) return { error: "กรอกรหัสผ่านใหม่" };
  const hash = await bcrypt.hash(password, 10);
  await db.none(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, id]);
  return { message: "รีเซ็ตรหัสผ่านเรียบร้อย" };
}

// ✅ ลบผู้ใช้
export async function adminDeleteUser(idParam: string) {
  const id = Number(idParam);
  if (!id) return { error: "id ไม่ถูกต้อง" };
  await db.none("DELETE FROM users WHERE id = $1", [id]);
  return { message: "ลบผู้ใช้เรียบร้อย" };
}

// src/server/controllers/auth.controller.ts
import { db } from "../db.config";
import { comparePassword } from "../auth/password";
import { signToken, verifyToken, type JwtPayload } from "../auth/session";

const asRole = (v: unknown): JwtPayload["role"] | null => {
  const s = String(v || "").toLowerCase();
  if (s === "admin" || s === "exec" || s === "dept_head" || s === "staff") return s;
  return null;
};

export const login = async (body: any) => {
  const { username, password } = body ?? {};
  if (!username || !password) return { error: "กรอกข้อมูลให้ครบ" };

  const user = await db.oneOrNone(
    `SELECT u.id, u.username, u.password_hash,
            LOWER(u.role_code) AS role_code,
            d.code AS department_code
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.username = $1`,
    [username]
  );
  if (!user) return { error: "ไม่พบผู้ใช้" };

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return { error: "รหัสผ่านไม่ถูกต้อง" };

  const role = asRole(user.role_code);
  if (!role) return { error: "สิทธิ์ผู้ใช้ไม่ถูกต้อง (role_code)" };

  const token = signToken({
    uid: Number(user.id),
    username: String(user.username),
    role,
    departmentCode: user.department_code || undefined,
  });

  return { token };
};

/**
 * คืนโปรไฟล์เมื่อ token ผ่าน, ถ้าไม่ผ่านให้คืน null
 * ปล่อยให้ชั้น route เป็นคนกำหนด HTTP status (200/401) ชัดเจน
 */
export const me = async (token?: string): Promise<JwtPayload | null> => {
  const payload = token ? verifyToken(token) : null;
  return payload ?? null;
};

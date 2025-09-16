import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export type JwtPayload = {
  uid: number;
  username: string;
  role: "admin" | "exec" | "dept_head" | "staff";
  departmentCode?: string;
};

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

export const verifyToken = (token?: string): JwtPayload | null => {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

// src/server/routes/qrcode.routes.ts
import type { Elysia } from "elysia";
import { genCentralQR } from "../controllers/qrcode.controller";

async function handler({ set, request }: any) {
  // คำนวณ origin จาก header (รองรับ proxy)
  const host =
    (request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "").trim();
  const proto = (request.headers.get("x-forwarded-proto") || "http").trim();
  const origin =
    host ? `${proto}://${host}` : (process.env.APP_BASE_URL || "http://localhost:3000");

  const png = await genCentralQR(origin);

  set.headers["Content-Type"] = "image/png";
  set.headers["Cache-Control"] = "public, max-age=3600"; // cache 1h
  return png;
}

export default (app: Elysia) =>
  app
    // PNG หลัก (แนะนำเรียกอันนี้)
    .get("/qrcode/central.png", handler)
    // alias เพื่อความถอยหลังเข้ากันได้ (หน้าเก่าเรียก /central ก็ยังใช้ได้)
    .get("/qrcode/central", handler);

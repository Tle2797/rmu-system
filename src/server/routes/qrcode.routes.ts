// server/routes/qrcode.routes.ts
import type { Elysia } from "elysia";
import { genCentralQR } from "../controllers/qrcode.controller";

export default (app: Elysia) =>
  app
    // GET /api/qrcode/central.png  -> ส่งภาพ PNG ของลิงก์ /survey
    .get("/qrcode/central.png", async ({ set, request }) => {
      // หา base URL แบบชัวร์ ๆ
      const host =
        (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").trim();
      const proto = (request.headers.get("x-forwarded-proto") || "http").trim();
      const origin = host ? `${proto}://${host}` : "";

      const png = await genCentralQR(origin || process.env.APP_BASE_URL || "http://localhost:3000");

      set.headers["Content-Type"] = "image/png";
      set.headers["Cache-Control"] = "public, max-age=3600"; // แคช 1 ชม.
      return png;
    });

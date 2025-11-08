// src/server/routes/auth.routes.ts
import type { Elysia } from "elysia";
import { login, me } from "../controllers/auth.controller";

export default (app: Elysia) =>
  app
    .post("/auth/login", async ({ body, set }) => {
      const result = await login(body);
      if ((result as any)?.error) {
        set.status = 400;
        return result;
      }
      const maxAge = 7 * 24 * 60 * 60;
      set.headers["Set-Cookie"] = [
        `token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${
          process.env.NODE_ENV === "production" ? "Secure;" : ""
        }`,
      ] as any;
      return { ok: true };
    })
    .get("/auth/me", async ({ request, set }) => {
      const bearer = request.headers.get("authorization");
      const fromBearer = bearer?.replace(/^Bearer\s+/i, "");
      const fromCookie = request.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)token=([^;]+)/)?.[1];
      const token = fromBearer || fromCookie || "";

      const profile = await me(token);
      if (!profile) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      return profile; // { uid, username, role, departmentCode }
    })
    .post("/auth/logout", async ({ set }) => {
      set.headers["Set-Cookie"] = `token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${
        process.env.NODE_ENV === "production" ? "Secure;" : ""
      }`;
      return { ok: true };
    });

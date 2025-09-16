import type { Elysia } from "elysia";
import {
  adminListUsers, adminCreateUser, adminUpdateUser, adminResetPassword, adminDeleteUser
} from "../controllers/admin.users.controller";

export default (app: Elysia) =>
  app
    .get("/admin/users", async () => adminListUsers())
    .post("/admin/users", async ({ body, set }) => {
      const r = await adminCreateUser(body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .put("/admin/users/:id", async ({ params, body, set }) => {
      const r = await adminUpdateUser(params.id, body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .post("/admin/users/:id/reset-password", async ({ params, body, set }) => {
      const r = await adminResetPassword(params.id, body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .delete("/admin/users/:id", async ({ params }) => adminDeleteUser(params.id));

import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import departmentRoutes from "@/server/routes/department.routes";
import responseRoutes from "@/server/routes/response.routes";
import surveyRoutes from "@/server/routes/survey.routes";
import dashboardRoutes from "@/server/routes/dashboard.routes";
import authRoutes from "@/server/routes/auth.routes";
import execRoutes from "@/server/routes/exec.routes";
import exec_extraRoutes from "@/server/routes/exec_extra.routes";
import adminRoutes from "@/server/routes/admin.routes";
import adminUsersRoutes from "@/server/routes/admin.users.routes";
import adminDepartmentsRoutes from "@/server/routes/admin.departments.routes";
import adminQuestionsRoutes from "@/server/routes/admin.questions.routes";
import commentsRoutes from "@/server/routes/comments.routes";
import qrcodeRoutes from "@/server/routes/qrcode.routes";


const app = new Elysia({ prefix: "api" })
  .use(swagger())
  .use(authRoutes)
  .use(departmentRoutes)
  .use(responseRoutes)
  .use(dashboardRoutes)
  .use(surveyRoutes)
  .use(execRoutes)
  .use(exec_extraRoutes)
  .use(adminRoutes)
  .use(adminUsersRoutes)
  .use(adminDepartmentsRoutes)
  .use(adminQuestionsRoutes)
  .use(commentsRoutes)
  .use(qrcodeRoutes)
  .get("/", () => "hello");


// ✅ สำคัญ: ต้อง export handle ของ Elysia ให้ Next.js
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;

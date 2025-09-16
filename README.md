# RMU Satisfaction System

ระบบประเมินหน่วยงานภายในสังกัดมหาวิทยาลัยราชภัฏมหาสารคาม  
พัฒนาด้วย **Next.js 14 (App Router)** + **Elysia (Bun)** + **PostgreSQL (Neon)** + **Tailwind CSS / shadcn/ui**  
รองรับการประเมินผ่าน QR Code, Dashboard แบบ Role-based, Export รายงาน PDF/Excel

---

## 🚀 Features

- **การเข้าสู่ระบบ (Authentication)**
  - JWT + Cookie
  - Role-based redirect:  
    - Admin → `/admin/users`  
    - Executive → `/exec`  
    - Department Head/Staff → `/dashboard/[code]`

- **Survey / QR**
  - 1 หน่วยงาน = 1 QR Code
  - แบบสอบถามกลาง (rating + comment)
  - Respondent (นักศึกษา/บุคลากร/บุคคลทั่วไป) สามารถทำแบบประเมินได้ทันที

- **Dashboard**
  - **Executive**: KPI, Distribution, Trend, Rank, Heatmap
  - **Department**: เฉลี่ยคะแนน, กราฟ, ความคิดเห็น, Export PDF/Excel
  - **Comments Intelligence**: วิเคราะห์ sentiment (บวก/กลาง/ลบ), CRUD ภารกิจจากคอมเมนต์

- **Admin Panel**
  - จัดการผู้ใช้ (`/admin/users`)
  - จัดการหน่วยงาน (`/admin/departments`)
  - จัดการคำถาม (`/admin/questions`)

- **Export**
  - Excel (ผ่าน `exceljs`)
  - PDF (ฝังฟอนต์ Sarabun รองรับภาษาไทย)

---

## 🏗️ Project Structure

```bash
app/
├─ (auth)/login/page.tsx              # ฟอร์มล็อกอิน
├─ (dashboard)/layout.tsx             # Layout หลังล็อกอิน + Sidebar
├─ (dashboard)/exec/                  # Executive overview
│  ├─ page.tsx                        # KPI/Trend/Dist
│  └─ rank/page.tsx                   # Heatmap + Ranking
├─ (dashboard)/dashboard/[code]/      # Dashboard หน่วยงาน
│  ├─ page.tsx                        # กราฟ/สรุป/Export
│  └─ comments/page.tsx               # Comments Intelligence + Actions
├─ (dashboard)/admin/                 # Admin CRUD
│  ├─ users/page.tsx
│  ├─ departments/page.tsx
│  └─ questions/page.tsx
├─ register-department/page.tsx       # ลงทะเบียนหน่วยงาน + QR
├─ survey/[code]/page.tsx             # ทำแบบประเมิน
└─ [[...slugs]]/route.ts              # รวม API (Elysia)
"# rmu-system" 
# rmu-system

# 2YHospital Backend API

RESTful API — **Express.js + TypeScript + Prisma + PostgreSQL + Redis**

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env   # ← Edit credentials

# 3. Start DB + Redis
docker-compose up postgres redis -d

# 4. Migrate + Seed
npx prisma migrate dev --name init
npm run prisma:seed

# 5. Run
npm run dev
# → http://localhost:3000/api/v1
```

---

## 🐳 Production (Docker)

```bash
docker-compose up --build -d
```

---

## 📋 All Endpoints

| Module | Base Path | Notes |
|--------|-----------|-------|
| Auth | `/api/v1/auth` | OTP, JWT, sessions |
| Users | `/api/v1/users` | Profile, dependents, allergies |
| Appointments | `/api/v1/appointments` | Book, cancel, reschedule |
| Waitlist | `/api/v1/appointments/waitlist` | Queue when fully booked |
| Medical Records | `/api/v1/medical-records` | Lab, radiology, prescriptions, uploads |
| Billing | `/api/v1/billing` | Invoices, Stripe, insurance claims |
| Doctors | `/api/v1/doctors` | Search, schedules, block slots |
| AI Assistant | `/api/v1/ai-assistant` | Patient chat, doctor summary, admin ops |
| Notifications | `/api/v1/notifications` | In-app + FCM push |
| Admin | `/api/v1/admin` | Dashboard, users, branches, audit logs |

---

## 🔐 Auth Flow

```
POST /auth/send-otp    { phone }           → sends OTP (max 3/5min)
POST /auth/verify-otp  { phone, otp }      → { accessToken, refreshToken }
POST /auth/refresh-token { refreshToken }  → new tokens
POST /auth/logout      { refreshToken }    → clears session
GET  /auth/me                              → current user
```

---

## ✅ Features Implemented

| Feature | Status |
|---------|--------|
| OTP login with throttle (3 attempts / 15min block) | ✅ |
| JWT access + refresh tokens | ✅ |
| Role-based access (PATIENT · DOCTOR · ADMIN · RECEPTIONIST · FINANCE) | ✅ |
| Patient overlap prevention (same time slot) | ✅ |
| Appointment reminder scheduler (24h + 2h before) | ✅ |
| Waitlist with automatic slot-open notifications | ✅ |
| Medical record file uploads (PDF, JPEG, DICOM) | ✅ |
| AI chat for patient (Arabic, safety guard) | ✅ |
| AI patient summary for doctor | ✅ |
| AI visit draft for doctor | ✅ |
| AI operational summary for admin | ✅ |
| Insurance claim submit + approve/reject | ✅ |
| Stripe payment integration | ✅ |
| FCM push notifications | ✅ |
| Allergies + chronic diseases endpoints | ✅ |
| Audit log for sensitive operations | ✅ |
| Full Prisma schema (15 models) | ✅ |
| Docker + docker-compose | ✅ |
| Database seed with test accounts | ✅ |

---

## 👤 Test Accounts (after seed)

| Role | Phone |
|------|-------|
| Admin | +966500000000 |
| Doctor | +966511111111 |
| Patient | +966522222222 |

> In dev mode, OTP is printed to console.

---

## 🗂️ Project Structure

```
src/
├── index.ts
├── config/          prisma · redis · env
├── middleware/      auth · error · validate · upload
├── modules/
│   ├── auth/        OTP · JWT · sessions
│   ├── users/       profile · dependents · allergies
│   ├── appointments/ booking · slots · reminder.scheduler · waitlist
│   ├── medical-records/ lab · radiology · prescriptions · uploads
│   ├── billing/     bills · insurance · payment-gateway (Stripe)
│   ├── doctors/     search · schedule · block-slots
│   ├── ai-assistant/ patient-chat · doctor-summary · admin-ops
│   ├── notifications/ in-app · FCM push · device-tokens
│   └── admin/       dashboard · users · branches · audit-logs
└── utils/           jwt · otp · response · audit
prisma/
└── schema.prisma    16 models · full relations
```

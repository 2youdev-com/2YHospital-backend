import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config } from './config/env';
import prisma from './config/prisma';

import { errorHandler, notFound } from './middleware/error.middleware';
import { startReminderScheduler } from './modules/appointments/reminder.scheduler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import medicalRecordsRoutes from './modules/medical-records/medical-records.routes';
import billingRoutes from './modules/billing/billing.routes';
import doctorsRoutes from './modules/doctors/doctors.routes';
import aiAssistantRoutes from './modules/ai-assistant/ai-assistant.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import adminRoutes from './modules/admin/admin.routes';
import waitlistRoutes from './modules/appointments/waitlist.routes';

const app = express();

// ─── Security ───
app.use(helmet());
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
}));

// ─── Rate limiting ───
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'تجاوزت عدد الطلبات المسموح بها، يرجى الانتظار قليلاً' },
});
app.use(limiter);

// ─── Stripe webhook needs raw body — must be before express.json() ───
// (handled inside billing.routes.ts with raw() middleware)

// ─── Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static uploads ───
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Logging ───
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// ─── Health check ───
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', timestamp: new Date().toISOString(), service: '2YHospital API v1' });
  } catch {
    res.status(503).json({ status: 'ERROR', message: 'Database not reachable' });
  }
});

// ─── API Routes ───
const prefix = config.apiPrefix;

app.use(`${prefix}/auth`, authRoutes);
app.use(`${prefix}/users`, usersRoutes);
app.use(`${prefix}/appointments`, appointmentsRoutes);
app.use(`${prefix}/appointments/waitlist`, waitlistRoutes);
app.use(`${prefix}/medical-records`, medicalRecordsRoutes);
app.use(`${prefix}/billing`, billingRoutes);
app.use(`${prefix}/doctors`, doctorsRoutes);
app.use(`${prefix}/ai-assistant`, aiAssistantRoutes);
app.use(`${prefix}/notifications`, notificationsRoutes);
app.use(`${prefix}/admin`, adminRoutes);

// ─── 404 + Error handlers ───
app.use(notFound);
app.use(errorHandler);

// ─── Start server ───
const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(config.port, () => {
      console.log(`\n🚀 2YHospital API running on port ${config.port}`);
      console.log(`📌 Base URL: http://localhost:${config.port}${config.apiPrefix}`);
      console.log(`🌍 Environment: ${config.nodeEnv}\n`);
    });

    // Start background schedulers
    startReminderScheduler();

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();

export default app;

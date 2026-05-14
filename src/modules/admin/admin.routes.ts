// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getDashboard,
  getWeeklyAppointments,
  getMonthlyRevenue,
  getMonthlyAppointments,
  getSpecialtyDistribution,
  getDoctorsStatus,
  getRecentAppointments,
  getUsers,
  toggleUserStatus,
  createPatient,
  getBranches,
  createBranch,
  updateBranch,
  createSpecialty,
  getAuditLogs,
  getRevenueReport,
} from './admin.controller';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'RECEPTIONIST', 'FINANCE'));

// Dashboard
router.get('/dashboard', authorize('ADMIN', 'RECEPTIONIST', 'FINANCE'), getDashboard);

// Analytics — real data endpoints
router.get('/analytics/weekly-appointments',   authorize('ADMIN'), getWeeklyAppointments);
router.get('/analytics/monthly-revenue',       authorize('ADMIN', 'FINANCE'), getMonthlyRevenue);
router.get('/analytics/monthly-appointments',  authorize('ADMIN'), getMonthlyAppointments);
router.get('/analytics/specialty-distribution',authorize('ADMIN'), getSpecialtyDistribution);
router.get('/analytics/doctors-status',        authorize('ADMIN'), getDoctorsStatus);
router.get('/analytics/recent-appointments',  authorize('ADMIN', 'RECEPTIONIST'), getRecentAppointments);

// Users
router.get('/users',                  authorize('ADMIN', 'RECEPTIONIST'), getUsers);
router.patch('/users/:id/toggle-status', authorize('ADMIN'), toggleUserStatus);
router.post('/patients',               authorize('ADMIN', 'RECEPTIONIST'), createPatient);

// Branches
router.get('/branches',    getBranches);
router.post('/branches',   authorize('ADMIN'), createBranch);
router.put('/branches/:id',authorize('ADMIN'), updateBranch);

// Specialties
router.post('/specialties', authorize('ADMIN'), createSpecialty);

// Audit & Reports
router.get('/audit-logs',       authorize('ADMIN'), getAuditLogs);
router.get('/reports/revenue',  authorize('ADMIN', 'FINANCE'), getRevenueReport);

export default router;

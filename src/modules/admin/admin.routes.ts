import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getDashboard, getUsers, toggleUserStatus,
  getBranches, createBranch, updateBranch,
  createSpecialty, getAuditLogs, getRevenueReport,
} from './admin.controller';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.patch('/users/:id/toggle-status', toggleUserStatus);
router.get('/branches', getBranches);
router.post('/branches', createBranch);
router.put('/branches/:id', updateBranch);
router.post('/specialties', createSpecialty);
router.get('/audit-logs', getAuditLogs);
router.get('/reports/revenue', getRevenueReport);

export default router;

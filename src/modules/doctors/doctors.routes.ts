import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  searchDoctors, getSpecialties, getDoctorProfile,
  getMyProfile, updateMyProfile, setSchedule, blockSlot,
  createDoctor, getDoctorStats,
} from './doctors.controller';

const router = Router();

// Public
router.get('/search', searchDoctors);
router.get('/specialties', getSpecialties);
router.get('/:id', getDoctorProfile);

// Doctor (protected)
router.get('/me/profile', authenticate, authorize('DOCTOR'), getMyProfile);
router.put('/me/profile', authenticate, authorize('DOCTOR'), updateMyProfile);
router.put('/me/schedule', authenticate, authorize('DOCTOR'), setSchedule);
router.post('/me/schedule/:scheduleId/block', authenticate, authorize('DOCTOR'), blockSlot);
router.get('/me/stats', authenticate, authorize('DOCTOR'), getDoctorStats);

// Admin
router.post('/', authenticate, authorize('ADMIN'), createDoctor);

export default router;

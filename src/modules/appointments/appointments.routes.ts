import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getSlots, bookAppointment, getMyAppointments, getAppointment,
  cancelAppointment, rescheduleAppointment, getTodaySchedule, getAllAppointments,
  updateStatus,
} from './appointments.controller';

const router = Router();
router.use(authenticate);

// Patient
router.get('/slots', getSlots);
router.post('/', authorize('PATIENT', 'ADMIN', 'RECEPTIONIST'), bookAppointment);
router.get('/my', authorize('PATIENT'), getMyAppointments);
router.get('/my/:id', authorize('PATIENT'), getAppointment);
router.patch('/my/:id/cancel', authorize('PATIENT'), cancelAppointment);
router.patch('/my/:id/reschedule', authorize('PATIENT'), rescheduleAppointment);

// Doctor
router.get('/today', authorize('DOCTOR'), getTodaySchedule);
router.get('/doctor/:id', authorize('DOCTOR'), getAppointment);
router.patch('/doctor/:id/status', authorize('DOCTOR'), updateStatus);

// Admin
router.get('/', authorize('ADMIN', 'RECEPTIONIST'), getAllAppointments);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST'), getAppointment);
router.patch('/:id/cancel', authorize('ADMIN', 'RECEPTIONIST'), cancelAppointment);
router.patch('/:id/status', authorize('ADMIN', 'RECEPTIONIST'), updateStatus);

export default router;

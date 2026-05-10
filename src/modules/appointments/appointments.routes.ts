import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getSlots, bookAppointment, getMyAppointments, getAppointment,
  cancelAppointment, rescheduleAppointment, getTodaySchedule, getAllAppointments,
} from './appointments.controller';

const router = Router();
router.use(authenticate);

// Patient
router.get('/slots', getSlots);
router.post('/', authorize('PATIENT'), bookAppointment);
router.get('/my', authorize('PATIENT'), getMyAppointments);
router.get('/my/:id', authorize('PATIENT'), getAppointment);
router.patch('/my/:id/cancel', authorize('PATIENT'), cancelAppointment);
router.patch('/my/:id/reschedule', authorize('PATIENT'), rescheduleAppointment);

// Doctor
router.get('/today', authorize('DOCTOR'), getTodaySchedule);

// Admin
router.get('/', authorize('ADMIN', 'RECEPTIONIST'), getAllAppointments);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { joinWaitlist, getMyWaitlist, cancelWaitlist, getAllWaitlist } from './waitlist.controller';

const router = Router();
router.use(authenticate);

// Patient
router.post('/', authorize('PATIENT'), joinWaitlist);
router.get('/my', authorize('PATIENT'), getMyWaitlist);
router.delete('/my/:id', authorize('PATIENT'), cancelWaitlist);

// Admin
router.get('/', authorize('ADMIN', 'RECEPTIONIST'), getAllWaitlist);

export default router;

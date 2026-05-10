import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getMyNotifications, markAsRead, markAllAsRead, registerDeviceToken } from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/device-token', registerDeviceToken);

export default router;

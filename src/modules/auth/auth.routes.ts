import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { sendOtp, verifyOtp, refreshToken, logout, getMe } from './auth.controller';

const router = Router();

// Egypt: accepts permissive format, detailed validation is in validatePhone (controller)
const phoneValidation = body('phone')
  .notEmpty().withMessage('رقم الهاتف مطلوب')
  .matches(/^\+?\d{10,15}$/).withMessage('رقم الهاتف غير صحيح');

router.post(
  '/send-otp',
  [phoneValidation],
  validate,
  sendOtp
);

router.post(
  '/verify-otp',
  [
    phoneValidation,
    body('otp')
      .isLength({ min: 6, max: 6 }).withMessage('رمز التحقق يجب أن يكون 6 أرقام')
      .isNumeric().withMessage('رمز التحقق يجب أن يحتوي أرقام فقط'),
  ],
  validate,
  verifyOtp
);

router.post(
  '/refresh-token',
  [body('refreshToken').notEmpty().withMessage('رمز التجديد مطلوب')],
  validate,
  refreshToken
);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';
import prisma from '../../config/prisma';

const authService = new AuthService();

const normalizePhone = (phone: string): string => {
  let p = phone.trim();
  if (p.startsWith('0')) p = '+966' + p.substring(1);
  if (!p.startsWith('+')) {
    if (p.startsWith('966')) p = '+' + p;
    else p = '+966' + p;
  }
  return p;
};

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = normalizePhone(req.body.phone);
    await authService.sendOtp(phone);
    sendSuccess(res, null, 'تم إرسال رمز التحقق إلى رقم جوالك');
  } catch (err: any) {
    sendError(res, err.message || 'فشل إرسال رمز التحقق', 500);
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;
    const result = await authService.verifyOtpAndLogin(phone, otp);
    sendSuccess(res, result, 'تم تسجيل الدخول بنجاح');
  } catch (err: any) {
    sendError(res, err.message || 'فشل تسجيل الدخول', 401);
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'تم تجديد الجلسة بنجاح');
  } catch (err: any) {
    sendError(res, err.message, 401);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    sendSuccess(res, null, 'تم تسجيل الخروج بنجاح');
  } catch (err: any) {
    sendError(res, 'فشل تسجيل الخروج', 500);
  }
};

// FIX: getMe now fetches fresh data from DB instead of returning JWT payload only.
// This ensures role changes and profile updates are reflected immediately.
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        phone: true,
        role: true,
        isActive: true,
        patient: { select: { nameAr: true, nameEn: true } },
        doctor:  { select: { nameAr: true, nameEn: true } },
        admin:   { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!user) { sendError(res, 'المستخدم غير موجود', 404); return; }
    if (!user.isActive) { sendError(res, 'الحساب موقوف', 403); return; }

    // Resolve name from the correct profile table based on role
    const profile = user.patient ?? user.doctor ?? user.admin;
    const name = profile?.nameAr || profile?.nameEn || '';

    sendSuccess(res, {
      id:    user.id,
      phone: user.phone,
      role:  user.role,
      name,
    }, 'بيانات المستخدم الحالي');
  } catch (err: any) {
    sendError(res, 'فشل جلب بيانات المستخدم', 500);
  }
};
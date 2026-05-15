import prisma from '../../config/prisma';
import { generateOtp, storeOtp, verifyOtp, sendOtpSms, checkOtpThrottle } from '../../utils/otp';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { UserRole } from '@prisma/client';

// FIX: Limit concurrent sessions per user to prevent session explosion
const MAX_SESSIONS_PER_USER = 5;

export class AuthService {
  async sendOtp(phone: string): Promise<void> {
    if (process.env.MOCK_OTP === 'true') {
      console.log(`[MOCK OTP] OTP requested for ${phone}`);
      return;
    }

    await checkOtpThrottle(phone);
    const otp = generateOtp();
    await storeOtp(phone, otp);
    await sendOtpSms(phone, otp);
  }

  async verifyOtpAndLogin(phone: string, otp: string) {
    if (process.env.MOCK_OTP !== 'true') {
      const isValid = await verifyOtp(phone, otp);
      if (!isValid) throw new Error('رمز التحقق غير صحيح أو منتهي الصلاحية');
    }

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          role: UserRole.PATIENT,
          patient: {
            create: {
              mrn: `MRN-${Date.now()}`,
              nameAr: '',
              dateOfBirth: new Date('2000-01-01'),
              gender: 'MALE',
            },
          },
        },
      });
    }

    if (!user.isActive) throw new Error('هذا الحساب موقوف، يُرجى التواصل مع الإدارة');

    const payload = { userId: user.id, role: user.role, phone: user.phone };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // FIX: Clean up old sessions if over the limit to prevent unbounded session growth
    const sessionCount = await prisma.session.count({ where: { userId: user.id } });
    if (sessionCount >= MAX_SESSIONS_PER_USER) {
      // Delete oldest sessions beyond the limit
      const oldest = await prisma.session.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        take: sessionCount - MAX_SESSIONS_PER_USER + 1,
        select: { id: true },
      });
      await prisma.session.deleteMany({
        where: { id: { in: oldest.map((s) => s.id) } },
      });
    }

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, user: { id: user.id, role: user.role, phone: user.phone } };
  }

  async refreshToken(token: string) {
    const payload = verifyRefreshToken(token);
    const session = await prisma.session.findUnique({ where: { refreshToken: token } });

    if (!session || session.expiresAt < new Date()) {
      // FIX: Clean up expired session if found
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      throw new Error('انتهت صلاحية الجلسة، يُرجى تسجيل الدخول مجدداً');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) throw new Error('المستخدم غير موجود أو الحساب موقوف');

    const newPayload = { userId: user.id, role: user.role, phone: user.phone };
    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    await prisma.session.update({
      where: { refreshToken: token },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.deleteMany({ where: { refreshToken } });
  }
}
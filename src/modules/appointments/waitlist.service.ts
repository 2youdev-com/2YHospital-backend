import prisma from '../../config/prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

const notifService = new NotificationsService();

export class WaitlistService {
  private async getPatientId(userId: string): Promise<string> {
    const p = await prisma.patient.findFirst({ where: { userId } });
    if (!p) throw new Error('المريض غير موجود');
    return p.id;
  }

  // Patient joins waitlist for a doctor on a date
  async joinWaitlist(userId: string, data: any) {
    const patientId = await this.getPatientId(userId);

    // Check not already on waitlist for same doctor+date
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        patientId,
        doctorId: data.doctorId,
        requestedDate: new Date(data.requestedDate),
        status: 'WAITING',
      },
    });
    if (existing) throw new Error('أنت بالفعل في قائمة الانتظار لهذا الطبيب في هذا اليوم');

    return prisma.waitlistEntry.create({
      data: {
        patientId,
        doctorId: data.doctorId,
        branchId: data.branchId || null,
        requestedDate: new Date(data.requestedDate),
        preferredTimes: data.preferredTimes || [],
        reason: data.reason,
      },
      include: {
        doctor: { select: { nameAr: true, specialty: { select: { nameAr: true } } } },
      },
    });
  }

  // Get patient's waitlist entries
  async getMyWaitlist(userId: string) {
    const patientId = await this.getPatientId(userId);
    return prisma.waitlistEntry.findMany({
      where: { patientId, status: 'WAITING' },
      include: {
        doctor: { include: { specialty: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Patient cancels waitlist entry
  async cancelWaitlist(userId: string, entryId: string) {
    const patientId = await this.getPatientId(userId);
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id: entryId, patientId },
    });
    if (!entry) throw new Error('الطلب غير موجود');
    return prisma.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'CANCELLED' },
    });
  }

  // System: notify waitlist when a slot opens up (called after cancellation)
  async notifyWaitlistForSlot(doctorId: string, date: Date, openedSlot: string): Promise<void> {
    // Find WAITING entries for this doctor+date sorted by join time
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        doctorId,
        requestedDate: date,
        status: 'WAITING',
      },
      include: {
        patient: { include: { user: true } },
        doctor: { select: { nameAr: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const entry of entries) {
      // Check if their preferred times include the opened slot (or they have no preference)
      const wantsThisSlot =
        entry.preferredTimes.length === 0 || entry.preferredTimes.includes(openedSlot);

      if (!wantsThisSlot) continue;

      const userId = entry.patient?.user?.id;
      if (!userId) continue;

      await notifService.sendNotification({
        userId,
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: 'موعد أصبح متاحاً!',
        body: `أصبح موعد متاح مع ${entry.doctor.nameAr} في ${date.toLocaleDateString('ar-SA')} الساعة ${openedSlot}. احجز الآن قبل أن ينتهي!`,
        extra: { doctorId, date: date.toISOString(), slot: openedSlot },
      });

      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      });

      // Only notify the first eligible patient per slot
      break;
    }
  }

  // Admin: view all waitlist entries
  async getAllWaitlist(doctorId?: string, date?: string) {
    const where: any = {};
    if (doctorId) where.doctorId = doctorId;
    if (date) where.requestedDate = new Date(date);

    return prisma.waitlistEntry.findMany({
      where,
      include: {
        patient: { select: { nameAr: true, mrn: true } },
        doctor: { select: { nameAr: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

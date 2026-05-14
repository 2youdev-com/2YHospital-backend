import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';

export class DoctorsService {
  async searchDoctors(filters: any, page = 1, limit = 10) {
    const { skip, take } = getPagination(page, limit);
    const where: any = { isAvailable: true };

    if (filters.specialtyId) where.specialtyId = filters.specialtyId;
    if (filters.name) {
      where.OR = [
        { nameAr: { contains: filters.name, mode: 'insensitive' } },
        { nameEn: { contains: filters.name, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          specialty: true,
          schedules: { where: { isActive: true }, include: { branch: true } },
        },
        skip,
        take,
      }),
      prisma.doctor.count({ where }),
    ]);

    return { items, pagination: buildPagination(total, page, limit) };
  }

  async getDoctorProfile(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        specialty: true,
        schedules: { where: { isActive: true }, include: { branch: true } },
      },
    });
    if (!doctor) throw new Error('الطبيب غير موجود');
    return doctor;
  }

  async getSpecialties() {
    return prisma.specialty.findMany({ orderBy: { nameAr: 'asc' } });
  }

  async getMyProfile(userId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { userId },
      include: { specialty: true, schedules: { include: { branch: true } } },
    });
    if (!doctor) throw new Error('الطبيب غير موجود');
    return doctor;
  }

  async updateMyProfile(userId: string, data: any) {
    const doctor = await prisma.doctor.findFirst({ where: { userId } });
    if (!doctor) throw new Error('الطبيب غير موجود');
    return prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        bio: data.bio,
        consultationFee: data.consultationFee,
        isAvailable: data.isAvailable,
      },
    });
  }

  async setSchedule(userId: string, scheduleData: any[]) {
    const doctor = await prisma.doctor.findFirst({ where: { userId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    // Upsert each day's schedule
    const results = await Promise.all(
      scheduleData.map((s) =>
        prisma.doctorSchedule.upsert({
          where: {
            doctorId_dayOfWeek_branchId: {
              doctorId: doctor.id,
              dayOfWeek: s.dayOfWeek,
              branchId: s.branchId || null,
            },
          },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration || 20,
            maxPatients: s.maxPatients || 1,
            isActive: s.isActive !== undefined ? s.isActive : true,
          },
          create: {
            doctorId: doctor.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration || 20,
            maxPatients: s.maxPatients || 1,
            branchId: s.branchId || null,
          },
        })
      )
    );
    return results;
  }

  async blockSlot(userId: string, scheduleId: string, data: any) {
    const doctor = await prisma.doctor.findFirst({ where: { userId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const schedule = await prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId: doctor.id },
    });
    if (!schedule) throw new Error('الجدول غير موجود');

    return prisma.blockedSlot.create({
      data: {
        scheduleId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
      },
    });
  }

  // Admin: create doctor
  async createDoctor(data: any) {
    // Normalize phone number to avoid duplicate account issues
    let p = data.phone?.trim() || '';
    if (p.startsWith('0')) p = '+966' + p.substring(1);
    if (!p.startsWith('+')) {
      if (p.startsWith('966')) p = '+' + p;
      else p = '+966' + p;
    }

    try {
      const user = await prisma.user.create({
        data: {
          phone: p,
          role: 'DOCTOR',
          doctor: {
            create: {
              nameAr: data.nameAr || data.name || 'طبيب جديد',
              nameEn: data.nameEn,
              specialtyId: data.specialtyId,
              licenseNumber: data.licenseNumber || `DOC-${Date.now()}`,
              bio: data.bio,
              consultationFee: data.consultationFee ? Number(data.consultationFee) : null,
            },
          },
        },
        include: { doctor: true },
      });
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('رقم الجوال مسجل مسبقاً في النظام');
      }
      throw error;
    }
  }

  async getDoctorStats(userId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { userId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({
        where: { doctorId: doctor.id, date: today },
      }),
      prisma.appointment.count({ where: { doctorId: doctor.id } }),
      prisma.appointment.count({
        where: { doctorId: doctor.id, status: 'COMPLETED' },
      }),
    ]);

    return { todayAppointments: todayCount, totalAppointments: totalCount, completedAppointments: completedCount };
  }
}

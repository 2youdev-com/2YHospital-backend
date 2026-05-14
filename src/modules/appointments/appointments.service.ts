// src/modules/appointments/appointments.service.ts
import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';
import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { WaitlistService } from './waitlist.service';
import { randomBytes } from 'crypto';

const waitlistService = new WaitlistService();

export class AppointmentsService {
  // FIX: Use crypto-based reference number to avoid timestamp collisions under load
  private generateRef(): string {
    const ts = Date.now().toString().slice(-6);
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `APT-${ts}${rand}`;
  }

  async getAvailableSlots(doctorId: string, date: string, branchId?: string) {
    const dateObj = new Date(date);
    const dayOfWeek = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][dateObj.getDay()];

    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId, dayOfWeek: dayOfWeek as any, isActive: true, ...(branchId && { branchId }) },
    });
    if (!schedule) return [];

    const blocked = await prisma.blockedSlot.findMany({
      where: { scheduleId: schedule.id, date: dateObj },
    });

    const booked = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: dateObj,
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
      },
      select: { startTime: true },
    });

    const bookedTimes = new Set(booked.map(a => a.startTime));

    const slots: string[] = [];
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m < endMinutes; m += schedule.slotDuration) {
      const h = Math.floor(m / 60).toString().padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      const timeStr = `${h}:${min}`;

      const isBlocked = blocked.some(b => b.startTime <= timeStr && timeStr < b.endTime);
      if (!isBlocked && !bookedTimes.has(timeStr)) {
        slots.push(timeStr);
      }
    }

    return slots;
  }

  async book(userId: string, data: any) {
    const { doctorId, date, startTime, type, reason, dependentId, branchId, patientId } = data;
    
    return prisma.$transaction(async (tx) => {
      let targetPatientId: string;

      if (patientId) {
        targetPatientId = patientId;
        const p = await tx.patient.findUnique({ where: { id: targetPatientId } });
        if (!p) throw new Error('المريض المحدد غير موجود في النظام');
      } else {
        const patient = await tx.patient.findFirst({ where: { userId } });
        if (!patient) throw new Error('المريض غير موجود');
        targetPatientId = patient.id;
      }

      const dateObj = new Date(date);
      const dayOfWeek = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][dateObj.getDay()];

      const schedule = await tx.doctorSchedule.findFirst({
        where: { doctorId, dayOfWeek: dayOfWeek as any, isActive: true, ...(branchId && { branchId }) },
      });
      if (!schedule) throw new Error('لا يوجد جدول متاح للطبيب في هذا اليوم');

      const normalizedStart = startTime.trim();

      // Check for blocked slots
      const isBlocked = await tx.blockedSlot.findFirst({
        where: { scheduleId: schedule.id, date: dateObj, startTime: { lte: normalizedStart }, endTime: { gt: normalizedStart } }
      });
      if (isBlocked) throw new Error('الموعد المختار محجوب حالياً');

      // Check if slot is already booked
      const existingAppt = await tx.appointment.findFirst({
        where: {
          doctorId,
          date: dateObj,
          startTime: normalizedStart,
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] }
        }
      });
      if (existingAppt) throw new Error('الموعد المختار محجوز بالفعل، يرجى اختيار وقت آخر');

      // Check if patient already has an appointment
      if (!dependentId) {
        const overlap = await tx.appointment.findFirst({
          where: {
            patientId: targetPatientId,
            date: dateObj,
            startTime: normalizedStart,
            status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
          },
        });
        if (overlap) throw new Error('المريض لديه موعد مؤكد بالفعل في هذا التوقيت');
      }

      const [h, m] = normalizedStart.split(':').map(Number);
      const duration = schedule.slotDuration || 20;
      const endMinutes = h * 60 + m + duration;
      const endTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;

      const appointment = await tx.appointment.create({
        data: {
          referenceNumber: this.generateRef(),
          patientId: targetPatientId,
          dependentId: dependentId || null,
          doctorId,
          branchId: branchId || null,
          date: dateObj,
          startTime: normalizedStart,
          endTime,
          type: (type as AppointmentType) || AppointmentType.NEW_VISIT,
          status: AppointmentStatus.CONFIRMED,
          reason: reason || null,
        },
        include: {
          doctor: { include: { specialty: true } },
          branch: true,
          patient: { select: { nameAr: true, mrn: true } }
        },
      });

      return appointment;
    }, { isolationLevel: 'Serializable' });
  }

  async getPatientAppointments(userId: string, status?: string, page = 1, limit = 10) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    const { skip, take } = getPagination(page, limit);
    const where = {
      patientId: patient.id,
      ...(status && { status: status as AppointmentStatus }),
    };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { doctor: { include: { specialty: true } }, branch: true },
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
        skip,
        take,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { items, pagination: buildPagination(total, page, limit) };
  }

  async getOne(appointmentId: string, userId: string, role?: string) {
    const where: any = { id: appointmentId };
    
    if (role === 'PATIENT') {
      const patient = await prisma.patient.findFirst({ where: { userId } });
      if (!patient) throw new Error('المريض غير موجود');
      where.patientId = patient.id;
    } else if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findFirst({ where: { userId } });
      if (!doctor) throw new Error('الطبيب غير موجود');
      where.doctorId = doctor.id;
    }

    const appt = await prisma.appointment.findFirst({
      where,
      include: {
        doctor: { include: { specialty: true } },
        patient: true,
        branch: true,
        dependent: true,
        bill: true,
      },
    });
    if (!appt) throw new Error('الموعد غير موجود');
    return appt;
  }

  async cancel(appointmentId: string, userId: string, role?: string, reason?: string) {
    const where: any = { id: appointmentId };

    if (role === 'PATIENT') {
      const patient = await prisma.patient.findFirst({ where: { userId } });
      if (!patient) throw new Error('المريض غير موجود');
      where.patientId = patient.id;
    } else if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findFirst({ where: { userId } });
      if (!doctor) throw new Error('الطبيب غير موجود');
      where.doctorId = doctor.id;
    }

    const appt = await prisma.appointment.findFirst({ where });
    if (!appt) throw new Error('الموعد غير موجود');
    if (
      ([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] as AppointmentStatus[]).includes(appt.status)
    ) {
      throw new Error('لا يمكن إلغاء هذا الموعد');
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });

    setImmediate(() => {
      waitlistService
        .notifyWaitlistForSlot(appt.doctorId, appt.date, appt.startTime)
        .catch(console.error);
    });

    return cancelled;
  }

  async reschedule(appointmentId: string, userId: string, newDate: string, newTime: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId: patient.id },
    });
    if (!appt) throw new Error('الموعد غير موجود');

    // FIX: Prevent rescheduling cancelled or completed appointments
    if (
      ([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] as AppointmentStatus[]).includes(appt.status)
    ) {
      throw new Error('لا يمكن إعادة جدولة هذا الموعد');
    }

    const available = await this.getAvailableSlots(appt.doctorId, newDate, appt.branchId || undefined);
    if (!available.includes(newTime)) throw new Error('الموعد الجديد غير متاح');

    const dateObj = new Date(newDate);
    const dayOfWeek = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][dateObj.getDay()];
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: appt.doctorId, dayOfWeek: dayOfWeek as any, isActive: true },
    });
    const [h, m] = newTime.split(':').map(Number);
    const endMinutes = h * 60 + m + (schedule?.slotDuration || 20);
    const endTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        date: dateObj,
        startTime: newTime,
        endTime,
        status: AppointmentStatus.RESCHEDULED,
        // FIX: Don't generate a new referenceNumber on reschedule, keep original for tracking
      },
    });
  }

  async getDoctorTodaySchedule(userId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { userId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        date: today,
        status: {
          in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING, AppointmentStatus.COMPLETED],
        },
      },
      include: {
        patient: { select: { nameAr: true, mrn: true, dateOfBirth: true } },
        dependent: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getAll(filters: any, page = 1, limit = 10) {
    const { skip, take } = getPagination(page, limit);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.date) where.date = new Date(filters.date);

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: {
            select: {
              nameAr: true, nameEn: true, mrn: true,
              user: { select: { phone: true } },
            },
          },
          doctor: { select: { nameAr: true, nameEn: true, specialty: { select: { nameAr: true } } } },
          branch: { select: { nameAr: true, nameEn: true } },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
        skip,
        take,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { items, pagination: buildPagination(total, page, limit) };
  }

  async updateStatus(appointmentId: string, userId: string, role: string, status: AppointmentStatus) {
    const where: any = { id: appointmentId };
    
    if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findFirst({ where: { userId } });
      if (!doctor) throw new Error('الطبيب غير موجود');
      where.doctorId = doctor.id;
    } // ADMIN/RECEPTIONIST can update any, PATIENT cannot update status directly via this route

    const appt = await prisma.appointment.findFirst({ where });
    if (!appt) throw new Error('الموعد غير موجود');

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });
  }
}
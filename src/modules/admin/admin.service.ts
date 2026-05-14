// src/modules/admin/admin.service.ts
import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';
import { UserRole } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dayBounds(offsetDays = 0): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthBounds(monthOffset = 0): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);
  return { start, end };
}

// ─── Service ─────────────────────────────────────────────────────────────────
export class AdminService {

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
    const today     = dayBounds(0);
    const yesterday = dayBounds(-1);
    const thisMonth = monthBounds(0);
    const lastMonth = monthBounds(-1);

    const [
      totalPatients,
      totalDoctors,
      totalAppointmentsToday,
      completedToday,
      pendingAppointments,
      cancelledToday,
      noShowToday,
      confirmedToday,
      yesterdayTotal,
      newPatientsThisMonth,
      newPatientsLastMonth,
      monthRevenue,
      lastMonthRevenue,
      totalUnpaidBills,
      waitlistCount,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count({ where: { user: { isActive: true } } }),

      // Today appointments
      prisma.appointment.count({ where: { date: { gte: today.start, lt: today.end } } }),
      prisma.appointment.count({ where: { date: { gte: today.start, lt: today.end }, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { status: 'PENDING' } }),
      prisma.appointment.count({ where: { date: { gte: today.start, lt: today.end }, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { date: { gte: today.start, lt: today.end }, status: 'NO_SHOW' } }),
      prisma.appointment.count({ where: { date: { gte: today.start, lt: today.end }, status: 'CONFIRMED' } }),

      // Yesterday for growth calc
      prisma.appointment.count({ where: { date: { gte: yesterday.start, lt: yesterday.end } } }),

      // New patients growth
      prisma.patient.count({ where: { createdAt: { gte: thisMonth.start, lt: thisMonth.end } } }),
      prisma.patient.count({ where: { createdAt: { gte: lastMonth.start, lt: lastMonth.end } } }),

      // Revenue from paid bills (paidAmount on bills — source of truth)
      prisma.bill.aggregate({
        where: { issueDate: { gte: thisMonth.start, lt: thisMonth.end }, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
        _sum: { paidAmount: true },
      }),
      prisma.bill.aggregate({
        where: { issueDate: { gte: lastMonth.start, lt: lastMonth.end }, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
        _sum: { paidAmount: true },
      }),

      // Unpaid bills count
      prisma.bill.count({ where: { status: 'UNPAID' } }),

      // Waitlist
      prisma.waitlistEntry.count(),
    ]);

    const totalRevenue   = monthRevenue?._sum?.paidAmount ? Number(monthRevenue._sum.paidAmount) : 0;
    const prevRevenue    = lastMonthRevenue?._sum?.paidAmount ? Number(lastMonthRevenue._sum.paidAmount) : 0;
    
    const revenueGrowth  = prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null;
    const appointmentGrowth = yesterdayTotal > 0
      ? Math.round(((totalAppointmentsToday - yesterdayTotal) / yesterdayTotal) * 100) : null;
    const newPatientsGrowth = newPatientsLastMonth > 0
      ? Math.round(((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100) : null;

    return {
      // Appointments
      totalAppointmentsToday,
      completedToday,
      pendingAppointments,
      cancelledToday,
      noShowToday,
      confirmedToday,
      appointmentGrowth,

      // People
      totalPatients,
      totalDoctors,
      newPatientsThisMonth,
      newPatientsGrowth,

      // Revenue
      totalRevenue,
      prevRevenue,
      revenueGrowth,

      // Billing
      totalUnpaidBills,

      // Waitlist
      waitlistCount,
    };
  }

  // ── Weekly Appointments — last 7 days ───────────────────────────────────────
  async getWeeklyAppointments() {
    const days = [6, 5, 4, 3, 2, 1, 0];
    const results = await Promise.all(days.map(async (i) => {
      const { start, end } = dayBounds(-i);
      const [total, completed, cancelled] = await Promise.all([
        prisma.appointment.count({ where: { date: { gte: start, lt: end } } }),
        prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: 'COMPLETED' } }),
        prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: 'CANCELLED' } }),
      ]);
      return {
        day: start.toLocaleDateString('ar-SA', { weekday: 'short' }),
        date: start.toISOString().split('T')[0],
        مواعيد: total,
        مكتملة: completed,
        ملغاة: cancelled,
      };
    }));
    return results;
  }

  // ── Monthly Revenue — last 6 months ─────────────────────────────────────────
  async getMonthlyRevenue() {
    const months = [5, 4, 3, 2, 1, 0];
    const results = await Promise.all(months.map(async (i) => {
      const { start, end } = monthBounds(-i);
      const [agg, billCount] = await Promise.all([
        prisma.bill.aggregate({
          where: { issueDate: { gte: start, lt: end }, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
          _sum: { paidAmount: true },
        }),
        prisma.bill.count({ where: { issueDate: { gte: start, lt: end } } }),
      ]);
      return {
        month: start.toLocaleDateString('ar-SA', { month: 'long' }),
        إيرادات: agg?._sum?.paidAmount ? Number(agg._sum.paidAmount) : 0,
        فواتير: billCount || 0,
      };
    }));
    return results;
  }

  // ── Monthly Appointments — last 6 months ─────────────────────────────────────
  async getMonthlyAppointments() {
    const months = [5, 4, 3, 2, 1, 0];
    const results = await Promise.all(months.map(async (i) => {
      const { start, end } = monthBounds(-i);
      const [total, completed, cancelled, noShow] = await Promise.all([
        prisma.appointment.count({ where: { date: { gte: start, lt: end } } }),
        prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: 'COMPLETED' } }),
        prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: 'CANCELLED' } }),
        prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: 'NO_SHOW' } }),
      ]);
      return {
        month: start.toLocaleDateString('ar-SA', { month: 'long' }),
        مواعيد: total,
        مكتملة: completed,
        ملغاة: cancelled,
        'لم يحضر': noShow,
      };
    }));
    return results;
  }

  // ── Specialty Distribution ───────────────────────────────────────────────────
  async getSpecialtyDistribution() {
    const rows = await prisma.appointment.groupBy({
      by: ['doctorId'],
      _count: { id: true },
    });
    if (rows.length === 0) return [];

    const doctorIds = rows.map((r) => r.doctorId);
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      include: { specialty: { select: { nameAr: true } } },
    });

    const specMap: Record<string, string> = {};
    doctors.forEach((d) => { specMap[d.id] = d.specialty?.nameAr ?? 'أخرى'; });

    const specCount: Record<string, number> = {};
    rows.forEach((r) => {
      const s = specMap[r.doctorId] ?? 'أخرى';
      specCount[s] = (specCount[s] ?? 0) + r._count.id;
    });

    return Object.entries(specCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  // ── Doctors Status ───────────────────────────────────────────────────────────
  async getDoctorsStatus() {
    const now  = new Date();
    const { start: todayStart, end: todayEnd } = dayBounds(0);
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const doctors = await prisma.doctor.findMany({
      where: { user: { isActive: true } },
      include: { specialty: { select: { nameAr: true } } },
      take: 10,
    });

    const doctorIds = doctors.map((d) => d.id);

    const todayAppts = await prisma.appointment.findMany({
      where: {
        doctorId: { in: doctorIds },
        date: { gte: todayStart, lt: todayEnd },
        status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] },
      },
      select: { doctorId: true, startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' },
    });

    const apptByDoctor: Record<string, typeof todayAppts> = {};
    for (const a of todayAppts) {
      if (!apptByDoctor[a.doctorId]) apptByDoctor[a.doctorId] = [];
      apptByDoctor[a.doctorId].push(a);
    }

    return doctors.map((doc) => {
      const appts = apptByDoctor[doc.id] ?? [];

      // Busy if currently in a CONFIRMED appointment window
      const isBusy = appts.some((a) => {
        if (a.status !== 'CONFIRMED') return false;
        const [sh, sm] = a.startTime.split(':').map(Number);
        const [eh, em] = (a.endTime ?? a.startTime).split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin   = eh * 60 + em || startMin + 30;
        const curMin   = now.getHours() * 60 + now.getMinutes();
        return curMin >= startMin && curMin < endMin;
      });

      const nextAppt = appts.find(
        (a) => a.status !== 'COMPLETED' && a.startTime > nowTime,
      );

      const activeToday = appts.filter((a) => a.status !== 'COMPLETED').length;

      let status: 'available' | 'busy' | 'off' = 'available';
      if (isBusy) status = 'busy';
      else if (activeToday === 0) status = 'off';

      return {
        id:               doc.id,
        name:             doc.nameAr,
        specialty:        doc.specialty?.nameAr ?? '—',
        status,
        next:             nextAppt?.startTime ?? null,
        appointmentsToday: appts.length,
        completedToday:   appts.filter((a) => a.status === 'COMPLETED').length,
      };
    });
  }

  // ── Recent Appointments (for dashboard quick view) ──────────────────────────
  async getRecentAppointments(limit = 5) {
    const { start, end } = dayBounds(0);
    const appts = await prisma.appointment.findMany({
      where: { date: { gte: start, lt: end } },
      include: {
        patient: { select: { nameAr: true, mrn: true } },
        doctor:  { select: { nameAr: true, specialty: { select: { nameAr: true } } } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
    return appts.map((a) => ({
      id:          a.id,
      refNum:      a.referenceNumber,
      patient:     a.patient.nameAr,
      mrn:         a.patient.mrn,
      doctor:      a.doctor.nameAr,
      specialty:   a.doctor.specialty?.nameAr ?? '—',
      time:        a.startTime,
      status:      a.status,
    }));
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  async getUsers(role?: string, page = 1, limit = 10) {
    const { skip, take } = getPagination(page, limit);
    const where: any = {};
    if (role) where.role = role as UserRole;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              nameAr: true, nameEn: true, mrn: true,
              dateOfBirth: true, gender: true, nationalId: true,
              bloodType: true, allergies: true, chronicDiseases: true,
            },
          },
          doctor: { select: { nameAr: true, nameEn: true, specialty: { select: { nameAr: true } } } },
          admin:  { select: { nameAr: true, nameEn: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.user.count({ where }),
    ]);

    const normalizedItems = items.map((u) => ({
      id:      u.id,
      patientId: u.patient?.id,
      phone:   u.phone,
      role:    u.role,
      isActive: u.isActive,
      name: (u.patient?.nameAr || u.patient?.nameEn || u.doctor?.nameAr || u.admin?.nameAr) ?? '',
      mrn:             u.patient?.mrn,
      dateOfBirth:     u.patient?.dateOfBirth,
      gender:          u.patient?.gender,
      nationalId:      u.patient?.nationalId,
      bloodType:       u.patient?.bloodType,
      allergies:       u.patient?.allergies    ?? [],
      chronicDiseases: u.patient?.chronicDiseases ?? [],
    }));

    return { items: normalizedItems, pagination: buildPagination(total, page, limit) };
  }

  async toggleUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('المستخدم غير موجود');
    return prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  }

  async createPatient(data: any) {
    // Normalize phone number
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
          role: 'PATIENT',
          patient: {
            create: {
              mrn: `MRN-${Date.now()}`,
              nameAr: data.nameAr || data.name || 'مريض جديد',
              nameEn: data.nameEn,
              nationalId: data.nationalId,
              gender: data.gender || 'MALE',
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date('2000-01-01'),
              bloodType: data.bloodType,
            },
          },
        },
        include: { patient: true },
      });
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('رقم الجوال مسجل مسبقاً في النظام');
      }
      throw error;
    }
  }

  // ── Branches ─────────────────────────────────────────────────────────────────
  async getBranches() {
    return prisma.branch.findMany({ orderBy: { nameAr: 'asc' } });
  }
  async createBranch(data: any) {
    return prisma.branch.create({
      data: { nameAr: data.nameAr, nameEn: data.nameEn, address: data.address, phone: data.phone },
    });
  }
  async updateBranch(id: string, data: any) {
    return prisma.branch.update({ where: { id }, data });
  }

  // ── Specialties ───────────────────────────────────────────────────────────────
  async createSpecialty(data: any) {
    return prisma.specialty.create({
      data: { nameAr: data.nameAr, nameEn: data.nameEn, code: data.code, icon: data.icon },
    });
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────────
  async getAuditLogs(page = 1, limit = 20) {
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { phone: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.auditLog.count(),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
  }

  // ── Revenue Report ────────────────────────────────────────────────────────────
  async getRevenueReport(from: string, to: string) {
    if (!from || !to) throw new Error('يرجى تحديد نطاق التاريخ');
    const bills = await prisma.bill.findMany({
      where: {
        issueDate: { gte: new Date(from), lte: new Date(to) },
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: { paidAmount: true, total: true, status: true, issueDate: true },
    });

    const totalPaid  = bills.reduce((s, b) => s + Number(b.paidAmount), 0);
    const totalBilled = bills.reduce((s, b) => s + Number(b.total), 0);

    return {
      totalPaid,
      totalBilled,
      collectionRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0,
      count: bills.length,
    };
  }
}
// src/modules/admin/admin.service.ts
import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';
import { UserRole } from '@prisma/client';

export class AdminService {
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(thisMonthStart);

    const [
      totalPatients,
      totalDoctors,
      totalAppointmentsToday,
      pendingAppointments,
      cancelledToday,
      yesterdayAppointments,
      monthlyRevenue,
      lastMonthRevenue,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.appointment.count({ where: { status: 'PENDING' } }),
      prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow }, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { date: { gte: yesterday, lt: today } } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: thisMonthStart }, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: lastMonthStart, lt: lastMonthEnd }, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = Number(monthlyRevenue._sum.amount) || 0;
    const prevRevenue = Number(lastMonthRevenue._sum.amount) || 0;
    const revenueGrowth = prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

    const appointmentGrowth = yesterdayAppointments > 0
      ? Math.round(((totalAppointmentsToday - yesterdayAppointments) / yesterdayAppointments) * 100)
      : 0;

    return {
      // FIX: Field names now match what the frontend DashboardStats type expects
      totalAppointmentsToday,
      totalDoctors,
      totalPatients,
      totalRevenue,
      pendingAppointments,
      cancelledToday,
      revenueGrowth,
      appointmentGrowth,
    };
  }

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
              nameAr: true, nameEn: true, mrn: true,
              dateOfBirth: true, gender: true, nationalId: true,
              bloodType: true, allergies: true, chronicDiseases: true,
            },
          },
          doctor: { select: { nameAr: true, nameEn: true, specialty: true } },
          admin: { select: { nameAr: true, nameEn: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.user.count({ where }),
    ]);

    // FIX: Normalize user shape so frontend gets a consistent Patient/User object
    const normalizedItems = items.map((u) => {
      const profile = u.patient ?? u.doctor ?? u.admin;
      const name = (u.patient?.nameAr || u.patient?.nameEn || u.doctor?.nameAr || u.admin?.nameAr) ?? '';

      return {
        id: u.id,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        name,
        // Patient-specific fields (flat)
        mrn: u.patient?.mrn,
        dateOfBirth: u.patient?.dateOfBirth,
        gender: u.patient?.gender,
        nationalId: u.patient?.nationalId,
        bloodType: u.patient?.bloodType,
        allergies: u.patient?.allergies ?? [],
        chronicDiseases: u.patient?.chronicDiseases ?? [],
      };
    });

    return { items: normalizedItems, pagination: buildPagination(total, page, limit) };
  }

  async toggleUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('المستخدم غير موجود');
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
  }

  // Branches
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

  // Specialties
  async createSpecialty(data: any) {
    return prisma.specialty.create({
      data: { nameAr: data.nameAr, nameEn: data.nameEn, code: data.code, icon: data.icon },
    });
  }

  // Audit logs
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

  // Revenue report
  async getRevenueReport(from: string, to: string) {
    if (!from || !to) throw new Error('يرجى تحديد نطاق التاريخ');

    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: new Date(from), lte: new Date(to) },
        status: 'SUCCESS',
      },
      select: { amount: true, method: true, paidAt: true },
    });

    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
    }

    return { total, byMethod, count: payments.length };
  }
}
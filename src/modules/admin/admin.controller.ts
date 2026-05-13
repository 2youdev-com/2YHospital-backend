// src/modules/admin/admin.controller.ts
import { Response } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new AdminService();

export const getDashboard = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getDashboardStats(), 'إحصائيات لوحة التحكم'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getRecentAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    sendSuccess(res, await svc.getRecentAppointments(limit), 'آخر المواعيد');
  } catch (e: any) { sendError(res, e.message); }
};

export const getWeeklyAppointments = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getWeeklyAppointments(), 'مواعيد الأسبوع'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getMonthlyRevenue = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getMonthlyRevenue(), 'الإيرادات الشهرية'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getMonthlyAppointments = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getMonthlyAppointments(), 'المواعيد الشهرية'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getSpecialtyDistribution = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getSpecialtyDistribution(), 'توزيع التخصصات'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getDoctorsStatus = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getDoctorsStatus(), 'حالة الأطباء'); }
  catch (e: any) { sendError(res, e.message); }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, page, limit } = req.query as any;
    const r = await svc.getUsers(role, +page || 1, +limit || 10);
    sendSuccess(res, r.items, 'المستخدمون', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.toggleUserStatus(req.params.id), 'تم تغيير حالة المستخدم'); }
  catch (e: any) { sendError(res, e.message, 404); }
};

export const getBranches = async (_req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.getBranches(), 'الفروع'); }
  catch (e: any) { sendError(res, e.message); }
};

export const createBranch = async (req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.createBranch(req.body), 'تم إنشاء الفرع', 201); }
  catch (e: any) { sendError(res, e.message); }
};

export const updateBranch = async (req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.updateBranch(req.params.id, req.body), 'تم تحديث الفرع'); }
  catch (e: any) { sendError(res, e.message); }
};

export const createSpecialty = async (req: AuthenticatedRequest, res: Response) => {
  try { sendSuccess(res, await svc.createSpecialty(req.body), 'تم إنشاء التخصص', 201); }
  catch (e: any) { sendError(res, e.message); }
};

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getAuditLogs(+page || 1, +limit || 20);
    sendSuccess(res, r.items, 'سجل العمليات', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getRevenueReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to } = req.query as any;
    sendSuccess(res, await svc.getRevenueReport(from, to), 'تقرير الإيرادات');
  } catch (e: any) { sendError(res, e.message); }
};
import { Response, Request } from 'express';
import { DoctorsService } from './doctors.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new DoctorsService();

export const searchDoctors = async (req: Request, res: Response) => {
  try {
    const { specialtyId, name, page, limit } = req.query as any;
    const r = await svc.searchDoctors({ specialtyId, name }, +page || 1, +limit || 10);
    sendSuccess(res, r.items, 'نتائج البحث', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getSpecialties = async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await svc.getSpecialties(), 'التخصصات');
  } catch (e: any) { sendError(res, e.message); }
};

export const getDoctorProfile = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, await svc.getDoctorProfile(req.params.id), 'ملف الطبيب');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const getMyProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getMyProfile(req.user!.id), 'ملفك الشخصي');
  } catch (e: any) { sendError(res, e.message); }
};

export const updateMyProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.updateMyProfile(req.user!.id, req.body), 'تم تحديث ملفك');
  } catch (e: any) { sendError(res, e.message); }
};

export const setSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const r = await svc.setSchedule(req.user!.id, req.body.schedules);
    sendSuccess(res, r, 'تم تحديث الجدول');
  } catch (e: any) { sendError(res, e.message); }
};

export const blockSlot = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const r = await svc.blockSlot(req.user!.id, req.params.scheduleId, req.body);
    sendSuccess(res, r, 'تم حجب الموعد', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const createDoctor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.createDoctor(req.body), 'تم إنشاء الطبيب', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const getDoctorStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getDoctorStats(req.user!.id), 'إحصائياتك');
  } catch (e: any) { sendError(res, e.message); }
};

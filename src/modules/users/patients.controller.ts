import { Response } from 'express';
import { PatientsService } from './patients.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new PatientsService();

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await svc.getProfile(req.user!.id);
    sendSuccess(res, data, 'تم جلب الملف الشخصي');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await svc.updateProfile(req.user!.id, req.body);
    sendSuccess(res, data, 'تم تحديث الملف الشخصي');
  } catch (e: any) { sendError(res, e.message); }
};

export const getDependents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await svc.getDependents(req.user!.id);
    sendSuccess(res, data, 'تم جلب قائمة التابعين');
  } catch (e: any) { sendError(res, e.message); }
};

export const addDependent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await svc.addDependent(req.user!.id, req.body);
    sendSuccess(res, data, 'تم إضافة التابع بنجاح', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const removeDependent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await svc.removeDependent(req.user!.id, req.params.id);
    sendSuccess(res, null, 'تم حذف التابع بنجاح');
  } catch (e: any) { sendError(res, e.message, 404); }
};

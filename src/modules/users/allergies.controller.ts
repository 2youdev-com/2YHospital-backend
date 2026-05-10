import { Response } from 'express';
import { PatientsService } from './patients.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new PatientsService();

export const addAllergy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { allergy } = req.body;
    if (!allergy?.trim()) { sendError(res, 'اسم الحساسية مطلوب', 422); return; }
    const result = await svc.addAllergy(req.user!.id, allergy.trim());
    sendSuccess(res, result, 'تم إضافة الحساسية');
  } catch (e: any) { sendError(res, e.message); }
};

export const removeAllergy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allergy = decodeURIComponent(req.params.allergy);
    const result = await svc.removeAllergy(req.user!.id, allergy);
    sendSuccess(res, result, 'تم حذف الحساسية');
  } catch (e: any) { sendError(res, e.message); }
};

export const updateChronicDiseases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { diseases } = req.body;
    if (!Array.isArray(diseases)) { sendError(res, 'يجب إرسال قائمة الأمراض المزمنة', 422); return; }
    const result = await svc.updateChronicDiseases(req.user!.id, diseases);
    sendSuccess(res, result, 'تم تحديث الأمراض المزمنة');
  } catch (e: any) { sendError(res, e.message); }
};

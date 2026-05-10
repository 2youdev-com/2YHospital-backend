import { Response } from 'express';
import { MedicalRecordsService } from './medical-records.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new MedicalRecordsService();

// Patient endpoints
export const getLabResults = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getLabResults(req.user!.id, +page||1, +limit||10);
    sendSuccess(res, r.items, 'نتائج المختبر', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getLabResult = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getLabResult(req.user!.id, req.params.id), 'تفاصيل نتيجة المختبر');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const getRadiologyReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getRadiologyReports(req.user!.id, +page||1, +limit||10);
    sendSuccess(res, r.items, 'تقارير الأشعة', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getRadiologyReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getRadiologyReport(req.user!.id, req.params.id), 'تقرير الأشعة');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const getPrescriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getPrescriptions(req.user!.id, +page||1, +limit||10);
    sendSuccess(res, r.items, 'الوصفات والأدوية', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getVisitHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getVisitHistory(req.user!.id, +page||1, +limit||10);
    sendSuccess(res, r.items, 'سجل الزيارات', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

// Doctor endpoints
export const getPatientSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await svc.getPatientSummary(req.params.patientId, req.user!.id);
    sendSuccess(res, data, 'ملخص المريض');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const addMedicalNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await svc.addMedicalNote(req.user!.id, req.params.patientId, req.body.content);
    sendSuccess(res, note, 'تم حفظ الملاحظة', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const approveMedicalNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await svc.approveMedicalNote(req.user!.id, req.params.noteId);
    sendSuccess(res, note, 'تم اعتماد الملاحظة');
  } catch (e: any) { sendError(res, e.message); }
};

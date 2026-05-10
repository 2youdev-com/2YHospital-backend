import { Response } from 'express';
import { AiAssistantService } from './ai-assistant.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new AiAssistantService();

// ─── Patient ───
export const chat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, sessionId } = req.body;
    if (!message?.trim()) { sendError(res, 'الرسالة مطلوبة', 422); return; }
    const result = await svc.chat(req.user!.id, message, sessionId);
    sendSuccess(res, result, 'تمت المعالجة');
  } catch (e: any) { sendError(res, e.message); }
};

export const getChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getChatHistory(req.user!.id, req.params.sessionId), 'سجل المحادثة');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const getMySessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getMySessions(req.user!.id), 'جلساتك');
  } catch (e: any) { sendError(res, e.message); }
};

// ─── Doctor ───
export const doctorPatientSummaryAI = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await svc.getDoctorPatientSummaryAI(req.user!.id, req.params.patientId);
    sendSuccess(res, { summary }, 'ملخص المريض الذكي');
  } catch (e: any) { sendError(res, e.message); }
};

export const draftVisitSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const draft = await svc.draftVisitSummary(req.user!.id, {
      patientId: req.params.patientId,
      notes: req.body.notes,
      chiefComplaint: req.body.chiefComplaint,
    });
    sendSuccess(res, { draft }, 'مسودة ملخص الزيارة');
  } catch (e: any) { sendError(res, e.message); }
};

// ─── Admin ───
export const adminOperationalSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly') || 'daily';
    const summary = await svc.getAdminOperationalSummary(period);
    sendSuccess(res, { summary, period }, 'الملخص التشغيلي');
  } catch (e: any) { sendError(res, e.message); }
};

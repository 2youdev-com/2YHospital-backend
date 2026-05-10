import { Response } from 'express';
import { WaitlistService } from './waitlist.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new WaitlistService();

export const joinWaitlist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = await svc.joinWaitlist(req.user!.id, req.body);
    sendSuccess(res, entry, 'تم إضافتك لقائمة الانتظار', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const getMyWaitlist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getMyWaitlist(req.user!.id), 'قائمة انتظارك');
  } catch (e: any) { sendError(res, e.message); }
};

export const cancelWaitlist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await svc.cancelWaitlist(req.user!.id, req.params.id);
    sendSuccess(res, null, 'تم إلغاء طلب الانتظار');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const getAllWaitlist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, date } = req.query as any;
    sendSuccess(res, await svc.getAllWaitlist(doctorId, date), 'قائمة الانتظار الكاملة');
  } catch (e: any) { sendError(res, e.message); }
};

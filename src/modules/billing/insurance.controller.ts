import { Response } from 'express';
import { InsuranceService } from './insurance.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new InsuranceService();

export const submitClaim = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await svc.submitClaim(req.params.billId, req.user!.id, req.body);
    sendSuccess(res, result, 'تم تقديم مطالبة التأمين بنجاح', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const getClaimStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getClaimStatus(req.params.billId, req.user!.id), 'حالة مطالبة التأمين');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const updateClaimStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await svc.updateClaimStatus(req.params.billId, req.body);
    sendSuccess(res, result, 'تم تحديث حالة المطالبة');
  } catch (e: any) { sendError(res, e.message); }
};

export const getPendingClaims = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getPendingClaims(), 'مطالبات التأمين المعلقة');
  } catch (e: any) { sendError(res, e.message); }
};

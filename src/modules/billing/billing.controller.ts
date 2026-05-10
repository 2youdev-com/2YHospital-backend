import { Response } from 'express';
import { BillingService } from './billing.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new BillingService();

export const getBills = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getBills(req.user!.id, +page || 1, +limit || 10);
    sendSuccess(res, r.items, 'فواتيرك', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getBill = async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await svc.getBill(req.user!.id, req.params.id), 'تفاصيل الفاتورة');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const payBill = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bill = await svc.payBill(req.user!.id, req.params.id, req.body.method);
    sendSuccess(res, bill, 'تم الدفع بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

export const getAllBills = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, branchId, page, limit } = req.query as any;
    const r = await svc.getAllBills({ status, branchId }, +page || 1, +limit || 10);
    sendSuccess(res, r.items, 'جميع الفواتير', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const createBill = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bill = await svc.createBill(req.body);
    sendSuccess(res, bill, 'تم إنشاء الفاتورة', 201);
  } catch (e: any) { sendError(res, e.message); }
};

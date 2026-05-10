import { Response, Request } from 'express';
import { PaymentGatewayService } from './payment-gateway.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new PaymentGatewayService();

export const createPaymentIntent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await svc.createPaymentIntent(req.params.billId, req.user!.id);
    sendSuccess(res, result, 'تم إنشاء جلسة الدفع');
  } catch (e: any) { sendError(res, e.message); }
};

export const confirmPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await svc.confirmPayment(req.body.paymentIntentId);
    sendSuccess(res, result, 'تم تأكيد الدفع');
  } catch (e: any) { sendError(res, e.message); }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const result = await svc.handleWebhook(req.body as Buffer, sig);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

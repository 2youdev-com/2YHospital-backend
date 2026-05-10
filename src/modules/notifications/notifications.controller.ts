import { Response } from 'express';
import { NotificationsService } from './notifications.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new NotificationsService();

export const getMyNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const r = await svc.getMyNotifications(req.user!.id, +page || 1, +limit || 20);
    sendSuccess(res, { items: r.items, unreadCount: r.unreadCount }, 'إشعاراتك', 200, r.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await svc.markAsRead(req.user!.id, req.params.id);
    sendSuccess(res, null, 'تم تعليمه كمقروء');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await svc.markAllAsRead(req.user!.id);
    sendSuccess(res, null, 'تم تعليم جميع الإشعارات كمقروءة');
  } catch (e: any) { sendError(res, e.message); }
};

export const registerDeviceToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) { sendError(res, 'token و platform مطلوبان', 422); return; }
    await svc.registerDeviceToken(req.user!.id, token, platform);
    sendSuccess(res, null, 'تم تسجيل جهازك للإشعارات');
  } catch (e: any) { sendError(res, e.message); }
};

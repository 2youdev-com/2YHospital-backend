import { Response } from 'express';
import { AppointmentsService } from './appointments.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const svc = new AppointmentsService();

export const getSlots = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, date, branchId } = req.query as any;
    const slots = await svc.getAvailableSlots(doctorId, date, branchId);
    sendSuccess(res, slots, 'المواعيد المتاحة');
  } catch (e: any) { sendError(res, e.message); }
};

export const bookAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appt = await svc.book(req.user!.id, req.body);
    sendSuccess(res, appt, 'تم حجز الموعد بنجاح', 201);
  } catch (e: any) { sendError(res, e.message); }
};

export const getMyAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, page, limit } = req.query as any;
    const result = await svc.getPatientAppointments(req.user!.id, status, +page || 1, +limit || 10);
    sendSuccess(res, result.items, 'مواعيدك', 200, result.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

export const getAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appt = await svc.getOne(req.params.id, req.user!.id);
    sendSuccess(res, appt, 'تفاصيل الموعد');
  } catch (e: any) { sendError(res, e.message, 404); }
};

export const cancelAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appt = await svc.cancel(req.params.id, req.user!.id, req.body.reason);
    sendSuccess(res, appt, 'تم إلغاء الموعد بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

export const rescheduleAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newDate, newTime } = req.body;
    const appt = await svc.reschedule(req.params.id, req.user!.id, newDate, newTime);
    sendSuccess(res, appt, 'تم إعادة جدولة الموعد بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

export const getTodaySchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appts = await svc.getDoctorTodaySchedule(req.user!.id);
    sendSuccess(res, appts, 'جدول اليوم');
  } catch (e: any) { sendError(res, e.message); }
};

export const getAllAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, doctorId, branchId, date, page, limit } = req.query as any;
    const result = await svc.getAll({ status, doctorId, branchId, date }, +page || 1, +limit || 10);
    sendSuccess(res, result.items, 'جميع المواعيد', 200, result.pagination);
  } catch (e: any) { sendError(res, e.message); }
};

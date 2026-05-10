import { Response, Request } from 'express';
import path from 'path';
import prisma from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';
import { buildFileUrl } from '../../middleware/upload.middleware';

// Upload lab result report PDF
export const uploadLabReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) { sendError(res, 'لم يتم رفع أي ملف', 422); return; }
    const { labResultId } = req.params;
    const fileUrl = buildFileUrl(req, req.file.path);

    const updated = await prisma.labResult.update({
      where: { id: labResultId },
      data: { reportUrl: fileUrl },
    });
    sendSuccess(res, { url: fileUrl, record: updated }, 'تم رفع تقرير المختبر بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

// Upload radiology report / image
export const uploadRadiologyFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) { sendError(res, 'لم يتم رفع أي ملف', 422); return; }
    const { reportId } = req.params;
    const fileUrl = buildFileUrl(req, req.file.path);
    const field = req.file.mimetype === 'application/pdf' ? 'reportUrl' : 'thumbnailUrl';

    const updated = await prisma.radiologyReport.update({
      where: { id: reportId },
      data: { [field]: fileUrl },
    });
    sendSuccess(res, { url: fileUrl, record: updated }, 'تم رفع ملف الأشعة بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

// General medical document upload (returns URL only)
export const uploadMedicalDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) { sendError(res, 'لم يتم رفع أي ملف', 422); return; }
    const fileUrl = buildFileUrl(req, req.file.path);
    sendSuccess(res, { url: fileUrl, originalName: req.file.originalname, size: req.file.size }, 'تم رفع الملف بنجاح');
  } catch (e: any) { sendError(res, e.message); }
};

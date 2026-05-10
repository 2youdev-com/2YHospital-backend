import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // FIX: Handle Prisma-specific errors with meaningful messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const field = (err.meta?.target as string[])?.join(', ') || 'حقل';
        res.status(409).json({
          success: false,
          message: `القيمة المدخلة في "${field}" مستخدمة بالفعل`,
        });
        return;
      }
      case 'P2025':
        // Record not found
        res.status(404).json({
          success: false,
          message: 'السجل المطلوب غير موجود',
        });
        return;
      case 'P2003':
        // Foreign key constraint
        res.status(400).json({
          success: false,
          message: 'العملية مرتبطة ببيانات أخرى لا يمكن حذفها',
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: 'خطأ في قاعدة البيانات',
        });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'بيانات غير صالحة',
    });
    return;
  }

  const statusCode = (err as any).statusCode || 500;
  const message = statusCode === 500 ? 'حدث خطأ داخلي في الخادم' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `المسار ${req.originalUrl} غير موجود`,
  });
};
import { Request } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../types';

export const createAuditLog = async (
  req: AuthenticatedRequest,
  action: string,
  entity: string,
  entityId?: string,
  oldData?: object,
  newData?: object
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action,
        entity,
        entityId,
        oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

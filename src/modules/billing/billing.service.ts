import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export class BillingService {
  private async getPatientId(userId: string): Promise<string> {
    const p = await prisma.patient.findFirst({ where: { userId } });
    if (!p) throw new Error('المريض غير موجود');
    return p.id;
  }

  async getBills(userId: string, page = 1, limit = 10) {
    const patientId = await this.getPatientId(userId);
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.bill.findMany({
        where: { patientId },
        include: { items: true, payments: true },
        orderBy: { issueDate: 'desc' },
        skip, take,
      }),
      prisma.bill.count({ where: { patientId } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
  }

  async getBill(userId: string, billId: string) {
    const patientId = await this.getPatientId(userId);
    const bill = await prisma.bill.findFirst({
      where: { id: billId, patientId },
      include: { items: true, payments: true, appointment: true },
    });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    return bill;
  }

  async payBill(userId: string, billId: string, method: string) {
    const patientId = await this.getPatientId(userId);
    const bill = await prisma.bill.findFirst({
      where: { id: billId, patientId },
    });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    if (bill.status === PaymentStatus.PAID) throw new Error('الفاتورة مدفوعة بالفعل');

    const remainingAmount = Number(bill.total) - Number(bill.paidAmount);

    // Create payment record
    await prisma.payment.create({
      data: {
        billId: bill.id,
        amount: remainingAmount,
        method: method as PaymentMethod,
        status: 'SUCCESS',
      },
    });

    // Update bill
    return prisma.bill.update({
      where: { id: billId },
      data: {
        paidAmount: Number(bill.total),
        status: PaymentStatus.PAID,
      },
      include: { items: true, payments: true },
    });
  }

  // Admin
  async getAllBills(filters: any, page = 1, limit = 10) {
    const { skip, take } = getPagination(page, limit);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.appointment = { branchId: filters.branchId };

    const [items, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          patient: { select: { nameAr: true, mrn: true } },
          items: true,
          payments: true,
        },
        orderBy: { issueDate: 'desc' },
        skip, take,
      }),
      prisma.bill.count({ where }),
    ]);

    return { items, pagination: buildPagination(total, page, limit) };
  }

  // Create bill (admin/system)
  async createBill(data: any) {
    const billNumber = `BILL-${Date.now()}`;
    const subtotal = data.items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
    const total = subtotal - (data.discount || 0) + (data.tax || 0);

    return prisma.bill.create({
      data: {
        billNumber,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        subtotal,
        discount: data.discount || 0,
        tax: data.tax || 0,
        total,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        items: {
          create: data.items.map((i: any) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.unitPrice * i.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }
}

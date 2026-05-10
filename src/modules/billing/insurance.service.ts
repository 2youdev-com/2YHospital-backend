import prisma from '../../config/prisma';

export interface InsuranceClaim {
  insuranceProvider: string;
  policyNumber: string;
  membershipId: string;
  claimAmount: number;
  diagnosis?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PARTIAL';
  approvedAmount?: number;
}

export class InsuranceService {
  // Submit insurance claim for a bill
  async submitClaim(billId: string, userId: string, claimData: Omit<InsuranceClaim, 'status' | 'submittedAt'>) {
    // Verify bill belongs to patient
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    const bill = await prisma.bill.findFirst({ where: { id: billId, patientId: patient.id } });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    if (bill.insuranceClaim && (bill.insuranceClaim as any).status === 'SUBMITTED') {
      throw new Error('تم تقديم مطالبة تأمين لهذه الفاتورة بالفعل');
    }

    const claim: InsuranceClaim = {
      ...claimData,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    };

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { insuranceClaim: claim as any },
    });

    return { bill: updated, claim };
  }

  // Get claim status for a bill
  async getClaimStatus(billId: string, userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    const bill = await prisma.bill.findFirst({
      where: { id: billId, patientId: patient.id },
      select: { id: true, billNumber: true, total: true, insuranceClaim: true, status: true },
    });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    if (!bill.insuranceClaim) throw new Error('لا توجد مطالبة تأمين لهذه الفاتورة');

    return bill;
  }

  // Admin: update claim status (approve / reject)
  async updateClaimStatus(
    billId: string,
    update: { status: 'APPROVED' | 'REJECTED' | 'PARTIAL'; approvedAmount?: number; rejectionReason?: string }
  ) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    if (!bill.insuranceClaim) throw new Error('لا توجد مطالبة تأمين');

    const existingClaim = bill.insuranceClaim as any;
    const updatedClaim: InsuranceClaim = {
      ...existingClaim,
      status: update.status,
      ...(update.status === 'APPROVED' && { approvedAt: new Date(), approvedAmount: update.approvedAmount }),
      ...(update.status === 'REJECTED' && { rejectedAt: new Date(), rejectionReason: update.rejectionReason }),
      ...(update.status === 'PARTIAL' && { approvedAt: new Date(), approvedAmount: update.approvedAmount }),
    };

    // If approved/partial, update bill paid amount
    let billUpdateData: any = { insuranceClaim: updatedClaim };
    if (update.status === 'APPROVED' || update.status === 'PARTIAL') {
      const approvedAmt = update.approvedAmount || 0;
      const newPaid = Number(bill.paidAmount) + approvedAmt;
      billUpdateData.paidAmount = newPaid;
      billUpdateData.status = newPaid >= Number(bill.total) ? 'PAID' : 'PARTIALLY_PAID';

      // Create payment record for insurance coverage
      await prisma.payment.create({
        data: {
          billId,
          amount: approvedAmt,
          method: 'INSURANCE',
          status: 'SUCCESS',
          notes: `مطالبة تأمين - ${existingClaim.insuranceProvider}`,
        },
      });
    }

    return prisma.bill.update({ where: { id: billId }, data: billUpdateData });
  }

  // Admin: list all pending insurance claims
  async getPendingClaims() {
    const bills = await prisma.bill.findMany({
      where: {
        insuranceClaim: { not: null as any },
      },
      include: {
        patient: { select: { nameAr: true, mrn: true } },
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return bills.filter((b) => {
      const claim = b.insuranceClaim as any;
      return claim?.status === 'SUBMITTED';
    });
  }
}

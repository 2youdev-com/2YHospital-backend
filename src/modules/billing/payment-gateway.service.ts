import Stripe from 'stripe';
import prisma from '../../config/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

export class PaymentGatewayService {
  // Create payment intent for online payment
  async createPaymentIntent(billId: string, userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    const bill = await prisma.bill.findFirst({ where: { id: billId, patientId: patient.id } });
    if (!bill) throw new Error('الفاتورة غير موجودة');
    if (bill.status === 'PAID') throw new Error('الفاتورة مدفوعة بالفعل');

    const remaining = Number(bill.total) - Number(bill.paidAmount);
    if (remaining <= 0) throw new Error('لا يوجد رصيد مستحق');

    if (process.env.NODE_ENV === 'development') {
      // Return mock intent in development
      return {
        clientSecret: `mock_secret_${billId}_${Date.now()}`,
        amount: remaining,
        currency: 'egp',
        billId,
        mode: 'development',
      };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(remaining * 100), // Stripe uses smallest currency unit
      currency: 'egp',
      metadata: { billId, patientId: patient.id, billNumber: bill.billNumber },
      description: `2YHospital - فاتورة رقم ${bill.billNumber}`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: remaining,
      currency: 'egp',
      billId,
    };
  }

  // Confirm payment after Stripe webhook
  async confirmPayment(paymentIntentId: string) {
    if (process.env.NODE_ENV === 'development') {
      return { success: true, message: 'Mock payment confirmed' };
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') throw new Error('الدفع لم يكتمل بعد');

    const billId = intent.metadata.billId;
    const amount = intent.amount / 100;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new Error('الفاتورة غير موجودة');

    await prisma.payment.create({
      data: {
        billId,
        amount,
        method: 'ONLINE',
        transactionId: paymentIntentId,
        status: 'SUCCESS',
        notes: 'Stripe payment',
      },
    });

    const newPaid = Number(bill.paidAmount) + amount;
    await prisma.bill.update({
      where: { id: billId },
      data: {
        paidAmount: newPaid,
        status: newPaid >= Number(bill.total) ? 'PAID' : 'PARTIALLY_PAID',
      },
    });

    return { success: true, billId, amountPaid: amount };
  }

  // Stripe webhook handler
  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.confirmPayment(intent.id);
    }

    return { received: true };
  }
}

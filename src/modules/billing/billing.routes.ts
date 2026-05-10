import { Router, raw } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { getBills, getBill, payBill, getAllBills, createBill } from './billing.controller';
import { submitClaim, getClaimStatus, updateClaimStatus, getPendingClaims } from './insurance.controller';
import { createPaymentIntent, confirmPayment, stripeWebhook } from './payment-gateway.controller';

const router = Router();

// ─── Stripe webhook (raw body needed) ───
router.post('/webhook/stripe', raw({ type: 'application/json' }), stripeWebhook);

router.use(authenticate);

// ─── Patient ───
router.get('/my', authorize('PATIENT'), getBills);
router.get('/my/:id', authorize('PATIENT'), getBill);
router.post('/my/:id/pay', authorize('PATIENT'), payBill);

// ─── Online payment (Stripe) ───
router.post('/my/:billId/payment-intent', authorize('PATIENT'), createPaymentIntent);
router.post('/confirm-payment', authorize('PATIENT'), confirmPayment);

// ─── Insurance claims ───
router.post('/my/:billId/insurance-claim', authorize('PATIENT'), submitClaim);
router.get('/my/:billId/insurance-claim', authorize('PATIENT'), getClaimStatus);

// ─── Admin / Finance ───
router.get('/', authorize('ADMIN', 'FINANCE'), getAllBills);
router.post('/', authorize('ADMIN', 'FINANCE', 'RECEPTIONIST'), createBill);
router.get('/insurance-claims/pending', authorize('ADMIN', 'FINANCE'), getPendingClaims);
router.patch('/:billId/insurance-claim/status', authorize('ADMIN', 'FINANCE'), updateClaimStatus);

export default router;

// src/routes/paymentsRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { listTripPayments, initiateSettlementPayment, claimPaymentPaid, rejectPaymentClaim, completePayment, resetTripPayments } from '../controllers/paymentsController.js';
import { paymentRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/trip/:trip_id', listTripPayments);
router.post('/trip/:trip_id/reset', resetTripPayments);
router.post('/initiate', paymentRateLimiter, initiateSettlementPayment);
router.post('/:id/claim-paid', paymentRateLimiter, claimPaymentPaid);
router.post('/:id/reject', paymentRateLimiter, rejectPaymentClaim);
router.patch('/:id/complete', paymentRateLimiter, completePayment);

export default router;




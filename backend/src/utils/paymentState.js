export const PAYMENT_STATUSES = Object.freeze([
  'pending',
  'payment_initiated',
  'awaiting_receiver_confirmation',
  'completed',
]);

export const isAllowedPaymentTransition = (fromStatus, toStatus, { legacyManualPayment = false } = {}) => {
  if (fromStatus === toStatus) return true;
  if (fromStatus === 'pending' && toStatus === 'payment_initiated') return true;
  if (fromStatus === 'payment_initiated' && toStatus === 'awaiting_receiver_confirmation') return true;
  if (fromStatus === 'awaiting_receiver_confirmation' && ['completed', 'pending'].includes(toStatus)) return true;
  return legacyManualPayment && fromStatus === 'pending' && toStatus === 'completed';
};

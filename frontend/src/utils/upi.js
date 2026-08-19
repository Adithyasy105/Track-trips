// frontend/src/utils/upi.js

/**
 * Convert an integer paise amount into a fixed 2-decimal INR string.
 *
 * Example:
 * 66667 -> "666.67"
 */
export const formatPaise = (amountPaise) => {
  const paise = Number(amountPaise);

  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new Error('Invalid paise amount.');
  }

  return (paise / 100).toFixed(2);
};

/**
 * Build a standard generic UPI payment URI.
 *
 * Important:
 * - `pa` = receiver's UPI ID
 * - `pn` = receiver name
 * - `am` = exact payment amount
 * - `cu` = INR
 * - `tr` = TripSync transaction reference
 * - `tn` = transaction note
 *
 * We intentionally DO NOT use `mam`.
 * Therefore the payment amount is not intentionally made editable
 * through the UPI URI.
 */
export const buildUpiPaymentUrl = ({
  upiId,
  payeeName,
  amountPaise,
  transactionId,
  note = 'TripSync Settlement',
}) => {
  if (!upiId || typeof upiId !== 'string') {
    throw new Error('Receiver UPI ID is required.');
  }

  const paise = Number(amountPaise);

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error('Invalid payment amount.');
  }

  const cleanUpiId = upiId.trim();

  if (!cleanUpiId) {
    throw new Error('Receiver UPI ID is required.');
  }

  const amount = formatPaise(paise);

  const params = new URLSearchParams({
    pa: cleanUpiId,
    pn: String(payeeName || cleanUpiId).trim(),
    am: amount,
    cu: 'INR',
    tr: String(transactionId || '').trim(),
    tn: String(note || 'TripSync Settlement').trim(),
  });

  return `upi://pay?${params.toString()}`;
};

/**
 * Detect whether the current browser is likely running on a mobile device.
 *
 * Android is the primary target for generic UPI Intent.
 * iOS is treated as mobile for UI purposes, but iOS may not provide
 * the same UPI-app chooser behavior as Android.
 */
export const isLikelyMobile = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent || ''
  );
};

/**
 * Open a generic UPI payment URI.
 *
 * This should normally be called directly from a user click/tap.
 * Calling it from useEffect can be blocked by the browser because
 * it is no longer considered a direct user gesture.
 */
export const openUpiPayment = (upiUrl) => {
  if (
    typeof upiUrl !== 'string' ||
    !upiUrl.startsWith('upi://pay?')
  ) {
    throw new Error('Invalid UPI payment URL.');
  }

  if (typeof window === 'undefined') {
    throw new Error('UPI payment can only be opened in a browser.');
  }

  window.location.href = upiUrl;

  return true;
};
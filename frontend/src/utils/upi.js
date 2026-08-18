export const formatPaise = (amountPaise) => (Number(amountPaise) / 100).toFixed(2);

export const buildUpiPaymentUrl = ({ upiId, payeeName, amountPaise, transactionId, note }) => {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: formatPaise(amountPaise),
    cu: 'INR',
    tr: transactionId,
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
};

export const isLikelyAndroid = () => /Android/i.test(navigator.userAgent || '');

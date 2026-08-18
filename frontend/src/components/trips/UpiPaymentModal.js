import React, { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import { buildUpiPaymentUrl, formatPaise, isLikelyAndroid } from '../../utils/upi';
import { paymentsAPI } from '../../services/api';

export const UpiPaymentModal = ({ payment, onClose, onUpdated }) => {
  const [claiming, setClaiming] = useState(false);
  const upiUrl = useMemo(() => buildUpiPaymentUrl({
    upiId: payment.receiverUpiId, payeeName: payment.receiverName, amountPaise: payment.amountPaise,
    transactionId: payment.reference_id, note: 'TripSync Settlement',
  }), [payment]);
  const android = isLikelyAndroid();
  const copyUpi = async () => {
    try { await navigator.clipboard.writeText(payment.receiverUpiId); toast.success('UPI ID copied'); }
    catch { toast.error('Unable to copy UPI ID'); }
  };
  const openUpi = () => { window.location.assign(upiUrl); };
  const claimPaid = async () => {
    try {
      setClaiming(true);
      const response = await paymentsAPI.claimPaid(payment.id);
      toast.success(`Waiting for @${payment.to_username} to confirm receipt.`);
      onUpdated?.(response.data);
      onClose();
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to submit payment confirmation'); }
    finally { setClaiming(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pay @{payment.to_username}</h3>
        <p className="mt-1 text-2xl font-black text-primary-600">₹{formatPaise(payment.amountPaise)}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">UPI ID: <span className="font-semibold">{payment.receiverUpiId}</span></p>
        {!android && <div className="mt-4 rounded-xl bg-white p-4 text-center dark:bg-white"><QRCode value={upiUrl} size={190} className="mx-auto" /><p className="mt-3 text-xs text-slate-600">Scan this QR code with any UPI app.</p></div>}
        <div className="mt-4 flex gap-2">
          <button onClick={copyUpi} className="btn-secondary flex-1 text-sm"><FaCopy className="mr-1 inline" /> Copy UPI ID</button>
          {android && <button onClick={openUpi} className="btn-primary flex-1 text-sm"><FaExternalLinkAlt className="mr-1 inline" /> Open UPI app</button>}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">After completing payment in your UPI app, tell TripSync. This does not complete the payment automatically.</p>
          <div className="mt-3 flex gap-2"><button onClick={onClose} className="btn-secondary flex-1">Cancel</button><button onClick={claimPaid} disabled={claiming} className="btn-primary flex-1">{claiming ? 'Submitting…' : 'Yes, I Paid'}</button></div>
        </div>
      </div>
    </div>
  );
};

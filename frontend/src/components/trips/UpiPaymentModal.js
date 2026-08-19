// frontend/src/components/trips/UpiPaymentModal.js

import React, { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';

import {
  buildUpiPaymentUrl,
  formatPaise,
  isLikelyMobile,
  openUpiPayment,
} from '../../utils/upi';

import { paymentsAPI } from '../../services/api';

export const UpiPaymentModal = ({
  payment,
  onClose,
  onUpdated,
}) => {
  const [claiming, setClaiming] = useState(false);
  const [openingUpi, setOpeningUpi] = useState(false);

  const mobile = isLikelyMobile();

  const amountPaise = Number(payment?.amountPaise);

  /**
   * The backend is authoritative for this amount.
   *
   * Never calculate the settlement amount on the frontend.
   */
  const formattedAmount = useMemo(() => {
    try {
      return formatPaise(amountPaise);
    } catch {
      return '0.00';
    }
  }, [amountPaise]);

  /**
   * Build the exact UPI URI from the authoritative payment.
   */
  const upiUrl = useMemo(() => {
    if (!payment?.receiverUpiId) {
      return '';
    }

    try {
      return buildUpiPaymentUrl({
        upiId: payment.receiverUpiId,
        payeeName:
          payment.receiverName ||
          payment.to_username ||
          payment.receiverUpiId,
        amountPaise,
        transactionId: payment.reference_id,
        note: 'TripSync Settlement',
      });
    } catch {
      return '';
    }
  }, [
    payment?.receiverUpiId,
    payment?.receiverName,
    payment?.to_username,
    payment?.reference_id,
    amountPaise,
  ]);

  /**
   * Copy receiver's UPI ID.
   */
  const copyUpi = async () => {
    if (!payment?.receiverUpiId) {
      toast.error('Receiver UPI ID is unavailable.');
      return;
    }

    try {
      await navigator.clipboard.writeText(
        payment.receiverUpiId
      );

      toast.success('UPI ID copied');
    } catch {
      toast.error('Unable to copy UPI ID');
    }
  };

  /**
   * Open the generic UPI Intent.
   *
   * IMPORTANT:
   * This is intentionally called from a button click instead
   * of useEffect so Android/browser treats it as a user gesture.
   *
   * TripSync does not choose Google Pay/PhonePe/BHIM itself.
   * Android determines which compatible UPI apps are available.
   */
  const handleOpenUpi = () => {
    if (!upiUrl) {
      toast.error('Unable to create UPI payment link.');
      return;
    }

    try {
      setOpeningUpi(true);

      openUpiPayment(upiUrl);

      /*
       * We intentionally do not mark the payment as paid here.
       *
       * Opening the UPI app does NOT prove that money was transferred.
       */
    } catch (error) {
      console.error('Failed to open UPI:', error);

      toast.error(
        'Unable to open UPI apps. You can copy the UPI ID instead.'
      );

      setOpeningUpi(false);
    }
  };

  /**
   * Sender claims that they completed the payment.
   *
   * This does NOT complete the payment.
   *
   * Backend transition:
   *
   * payment_initiated
   *        ↓
   * awaiting_receiver_confirmation
   */
  const claimPaid = async () => {
    if (claiming) {
      return;
    }

    if (!payment?.id) {
      toast.error('Payment information is missing.');
      return;
    }

    try {
      setClaiming(true);

      const response = await paymentsAPI.claimPaid(
        payment.id
      );

      toast.success(
        `Waiting for @${payment.to_username} to confirm receipt.`
      );

      onUpdated?.(response.data);

      onClose?.();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          'Unable to submit payment confirmation.'
      );
    } finally {
      setClaiming(false);
    }
  };

  if (!payment) {
    return null;
  }

  return (
    <div
      className="
        fixed inset-0 z-[70]
        flex items-center justify-center
        bg-slate-950/60
        p-4
        backdrop-blur-sm
      "
      onClick={onClose}
    >
      <div
        className="
          w-full max-w-md
          rounded-2xl
          bg-white
          p-5
          shadow-2xl
          dark:bg-slate-800
        "
        onClick={(event) => event.stopPropagation()}
      >
        {/* HEADER */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Pay @{payment.to_username}
          </h3>

          <p className="mt-1 text-3xl font-black text-primary-600">
            ₹{formattedAmount}
          </p>
        </div>

        {/* RECEIVER DETAILS */}
        <div
          className="
            mt-4 rounded-xl
            bg-slate-50 p-3
            dark:bg-slate-700/50
          "
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paying to
          </p>

          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {payment.receiverName ||
              payment.to_username}
          </p>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {payment.receiverUpiId}
          </p>
        </div>

        {/* MOBILE UPI INTENT */}
        {mobile && (
          <div className="mt-5">
            <div
              className="
                rounded-xl
                bg-emerald-50
                p-4
                text-sm
                text-emerald-800
                dark:bg-emerald-900/20
                dark:text-emerald-200
              "
            >
              <p className="font-semibold">
                Pay securely with UPI
              </p>

              <p className="mt-1 text-xs leading-5">
                Your phone will show compatible UPI apps
                such as Google Pay, PhonePe, BHIM, Paytm,
                or other installed UPI apps.
              </p>

              <p className="mt-2 text-xs font-semibold">
                Amount: ₹{formattedAmount}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenUpi}
              disabled={openingUpi || !upiUrl}
              className="
                btn-primary
                mt-3
                flex w-full
                items-center
                justify-center
                gap-2
                text-sm
              "
            >
              <FaExternalLinkAlt />

              {openingUpi
                ? 'Opening UPI…'
                : `Pay ₹${formattedAmount} with UPI`}
            </button>

            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              The exact TripSync settlement amount is
              included in the UPI payment request.
            </p>

            <button
              type="button"
              onClick={copyUpi}
              className="
                btn-secondary
                mt-3
                w-full
                text-sm
              "
            >
              <FaCopy className="mr-1 inline" />
              Copy UPI ID
            </button>
          </div>
        )}

        {/* DESKTOP QR */}
        {!mobile && (
          <div className="mt-5">
            <div
              className="
                rounded-xl
                bg-white
                p-4
                text-center
              "
            >
              {upiUrl ? (
                <QRCode
                  value={upiUrl}
                  size={210}
                  className="mx-auto"
                />
              ) : (
                <div className="flex h-[210px] items-center justify-center text-sm text-slate-500">
                  Unable to generate payment QR.
                </div>
              )}

              <p className="mt-3 text-xs text-slate-600">
                Scan this QR code using Google Pay,
                PhonePe, BHIM, Paytm, or another UPI app.
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-700">
                ₹{formattedAmount}
              </p>
            </div>

            <button
              type="button"
              onClick={copyUpi}
              className="
                btn-secondary
                mt-3
                w-full
                text-sm
              "
            >
              <FaCopy className="mr-1 inline" />
              Copy UPI ID
            </button>
          </div>
        )}

        {/* MANUAL CONFIRMATION */}
        <div
          className="
            mt-5
            border-t
            border-slate-200
            pt-4
            dark:border-slate-700
          "
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            After completing the payment in your UPI app,
            return to TripSync and confirm that you paid.
          </p>

          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Opening a UPI app does not mark the payment as
            completed. The receiver must verify and confirm
            receipt.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={claiming}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={claimPaid}
              disabled={claiming}
              className="btn-primary flex-1"
            >
              {claiming
                ? 'Submitting…'
                : 'Yes, I Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
// src/components/trips/PaymentsTab.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  FaCheckCircle,
  FaHourglassHalf,
  FaClock,
  FaArrowRight,
} from 'react-icons/fa';
import { paymentsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { UpiPaymentModal } from './UpiPaymentModal';

export const PaymentsTab = ({ tripId }) => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [completedPayments, setCompletedPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [upiPayment, setUpiPayment] = useState(null);
  const { user } = useAuth();
  const currentUser = user?.username;

  const formatAmount = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : '—';

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await paymentsAPI.listTrip(tripId);
      const allPayments = response.data || [];
      setPendingPayments(allPayments.filter((p) => p.status !== 'completed'));
      setCompletedPayments(allPayments.filter((p) => p.status === 'completed'));
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleMarkReceived = async (paymentId) => {
    try {
      setSaving(paymentId);
      await paymentsAPI.complete(paymentId);
      toast.success('Payment marked as received!');
      await loadPayments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to mark payment as received');
    } finally {
      setSaving(null);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      setSaving(paymentId);
      await paymentsAPI.reject(paymentId);
      toast.success('Payment returned to pending');
      await loadPayments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to reject payment');
    } finally { setSaving(null); }
  };

  const beginPayment = async (payment) => {
    try {
      setSaving(payment.id);
      const response = await paymentsAPI.initiate({ trip_id: tripId, to_username: payment.to_username, amount_paise: payment.amount_paise ?? Math.round(Number(payment.amount) * 100) });
      setUpiPayment(response.data);
      await loadPayments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to start this payment');
    } finally { setSaving(null); }
  };

  const overview = useMemo(() => {
    const pendingTotal = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const completedTotal = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return {
      pendingCount: pendingPayments.length,
      pendingTotal: formatAmount(pendingTotal),
      completedCount: completedPayments.length,
      completedTotal: formatAmount(completedTotal),
    };
  }, [pendingPayments, completedPayments]); // eslint-disable-line

  const getInitial = (username = '') =>
    username.trim()?.charAt(0)?.toUpperCase() || '?';

  const StatusBadge = ({ status }) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/40">
          <FaHourglassHalf className="h-2.5 w-2.5" /> Pending
        </span>
      );
    }
    if (status === 'payment_initiated') return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Payment initiated</span>;
    if (status === 'awaiting_receiver_confirmation') return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Awaiting receiver confirmation</span>;
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/40">
        <FaCheckCircle className="h-2.5 w-2.5" /> Completed
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Loading payments…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FaHourglassHalf className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Pending</p>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{overview.pendingTotal}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            {overview.pendingCount} payment{overview.pendingCount === 1 ? '' : 's'} outstanding
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FaCheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Completed</p>
          </div>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{overview.completedTotal}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            {overview.completedCount} cleared
          </p>
        </div>
      </div>

      {/* Pending Payments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FaHourglassHalf className="h-4 w-4 text-amber-500" />
            Pending Payments
          </h3>
          {pendingPayments.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">← Swipe →</span>
          )}
        </div>
        {pendingPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            All payments are settled.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-[560px] w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">From</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">To</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="pb-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {pendingPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    {/* From */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {getInitial(payment.from_username)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[100px]" title={`@${payment.from_username}`}>
                          @{payment.from_username}
                        </span>
                      </div>
                    </td>
                    {/* Arrow + To */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <FaArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {getInitial(payment.to_username)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[100px]" title={`@${payment.to_username}`}>
                          @{payment.to_username}
                        </span>
                      </div>
                    </td>
                    {/* Amount */}
                    <td className="py-3 pr-4 font-bold text-gray-900 dark:text-white">
                      {formatAmount(payment.amount)}
                    </td>
                    {/* Status */}
                    <td className="py-3 pr-4">
                      <StatusBadge status={payment.status} />
                    </td>
                    {/* Action */}
                    <td className="py-3">
                      {currentUser === payment.from_username && ['pending', 'payment_initiated'].includes(payment.status) ? (
                        <button onClick={() => beginPayment(payment)} disabled={saving === payment.id} className="btn-primary text-xs py-1.5 px-3">
                          {saving === payment.id ? 'Preparing…' : payment.status === 'pending' ? `Pay ${formatAmount(payment.amount)}` : 'Continue / Try Again'}
                        </button>
                      ) : currentUser === payment.to_username && payment.status === 'awaiting_receiver_confirmation' ? (
                        <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkReceived(payment.id)}
                          disabled={saving === payment.id}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <FaCheckCircle className="h-3 w-3" />
                          {saving === payment.id ? 'Marking…' : 'Mark Received'}
                        </button>
                        {payment.status === 'awaiting_receiver_confirmation' && <button onClick={() => handleReject(payment.id)} disabled={saving === payment.id} className="btn-secondary text-xs py-1.5 px-3">Reject</button>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">{payment.status === 'awaiting_receiver_confirmation' ? 'Awaiting receiver confirmation' : 'No action needed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Payments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FaCheckCircle className="h-4 w-4 text-emerald-500" />
            Completed Payments
          </h3>
          {completedPayments.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">← Swipe →</span>
          )}
        </div>
        {completedPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No completed payments yet.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-[480px] w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">From</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">To</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="pb-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {completedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {getInitial(payment.from_username)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[100px]" title={`@${payment.from_username}`}>
                          @{payment.from_username}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <FaArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {getInitial(payment.to_username)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[100px]" title={`@${payment.to_username}`}>
                          @{payment.to_username}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-bold text-gray-900 dark:text-white">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="py-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pt-5">
                      <FaClock className="h-3 w-3" />
                      {formatDateTime(payment.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {upiPayment && <UpiPaymentModal payment={upiPayment} onClose={() => setUpiPayment(null)} onUpdated={loadPayments} />}
    </div>
  );
};

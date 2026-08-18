// src/components/trips/SettlementsTab.js
//
// RESPONSIVE STRATEGY (mobile-first):
// - Base styles target ~320–375px phones. Every sm:/md: class ADDS space,
//   never removes it, so nothing needs to "undo" a desktop-first default.
// - All text/icon/avatar sizes scale up via sm: rather than being fixed —
//   this avoids the "cramped tablet" problem where a size jump from mobile
//   straight to desktop breaks at in-between widths.
// - Long usernames/numbers always sit inside a `min-w-0` + `truncate`
//   flex child so they can never push a sibling off-screen or force
//   horizontal scroll on narrow devices.
// - The "AI Explain" action becomes full-width below the header on mobile
//   instead of squeezing into the header row.

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaArrowRight, FaRupeeSign } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { settlementsAPI, aiAPI } from '../../services/api';
import { paymentsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { UpiPaymentModal } from './UpiPaymentModal';

const formatINR = (amount) => {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}₹${formatted}`;
};

/* ============================================================
   SKELETON — mirrors the real layout (header, 2 stat cards,
   balances list) so there's no layout shift on load.
============================================================ */

const SettlementsSkeleton = () => (
  <div className="space-y-6 animate-pulse" aria-hidden="true">
    <div className="space-y-2">
      <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded-md" />
      <div className="h-3.5 w-56 bg-slate-100 dark:bg-slate-800 rounded-md" />
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl border border-sky-200/60 dark:border-slate-700 p-4">
          <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-sky-200/60 dark:border-slate-700 space-y-3">
      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 bg-sky-50/50 dark:bg-slate-900/60 rounded-xl" />
      ))}
    </div>
  </div>
);

export const SettlementsTab = ({ tripId }) => {
  const [settlements, setSettlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [openingSettlement, setOpeningSettlement] = useState(null);
  const [upiPayment, setUpiPayment] = useState(null);
  const { user } = useAuth();

  const beginPayment = async (settlement) => {
    try {
      setOpeningSettlement(settlement);
      const amount_paise = Math.round(Number(settlement.amount) * 100);
      const response = await paymentsAPI.initiate({ trip_id: tripId, to_username: settlement.to, amount_paise });
      setUpiPayment(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to start this payment');
    } finally { setOpeningSettlement(null); }
  };

  const loadSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await settlementsAPI.getTripSettlements(tripId);
      setSettlements(response.data);
    } catch (error) {
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const handleFetchAiExplanation = async () => {
    setAiLoading(true);
    try {
      const response = await aiAPI.getSettlementExplain(tripId);
      setAiExplanation(response.data.explanation);
    } catch (error) {
      toast.error('Failed to generate AI explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  if (loading) {
    return <SettlementsSkeleton />;
  }

  if (!settlements) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-sky-200/80 dark:border-slate-700 text-center py-12 px-4 shadow-sm">
        <FaRupeeSign className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">No settlement data available</p>
      </div>
    );
  }

  const balanceEntries = Object.entries(settlements.balances || {});

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ==========================================================
          HEADER
          Mobile: title stacked, AI button full-width below it.
          sm+: title left, button right, same row.
      ========================================================== */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            Settlements
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Who owes whom and how to settle up
          </p>
        </div>

        <button
          onClick={handleFetchAiExplanation}
          disabled={aiLoading}
          className="
            w-full sm:w-auto
            inline-flex items-center justify-center gap-2
            text-xs sm:text-sm font-semibold
            px-4 py-2.5 sm:py-2 rounded-xl
            bg-primary-50 dark:bg-primary-900/30
            text-primary-700 dark:text-primary-300
            border border-primary-200 dark:border-primary-800
            hover:bg-primary-100 dark:hover:bg-primary-900/50
            transition-colors
            disabled:opacity-60 disabled:cursor-not-allowed
            flex-shrink-0
          "
        >
          {aiLoading ? (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <HiSparkles className="h-4 w-4" />
          )}
          {aiLoading ? 'Analyzing…' : 'AI Explain Breakdown'}
        </button>
      </div>

      {/* AI Explanation Card */}
      {aiExplanation && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sky-200 dark:border-slate-700 bg-sky-50 dark:bg-slate-800 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <HiSparkles className="h-4 w-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
              AI Financial Breakdown
            </h3>
          </div>
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-9">
            {aiExplanation}
          </div>
        </motion.div>
      )}

      {/* ==========================================================
          SUMMARY STATS
          truncate + min-w-0 so large INR numbers never overflow
          the card on 320px screens.
      ========================================================== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="min-w-0 bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-sky-200/80 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 truncate">
            Total Trip Expenses
          </p>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
            ₹{Number(settlements.summary?.total_expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="min-w-0 bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-sky-200/80 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 truncate">
            Total Expense Count
          </p>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
            {settlements.summary?.total_expenses_count ?? 0}
          </p>
        </div>
      </div>

      {/* ==========================================================
          MEMBER BALANCES
      ========================================================== */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-sky-200/80 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            Member Balances
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium flex-shrink-0">
            Net = Paid − Share
          </span>
        </div>

        {balanceEntries.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
            No balances calculated yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {balanceEntries.map(([username, balance]) => {
              const net =
                Number.isFinite(Number(balance?.net))
                  ? Number(balance.net)
                  : (Number(balance.paid || 0) - Number(balance.owes || 0));
              return (
                <div
                  key={username}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-sky-50/50 dark:bg-slate-900/60 rounded-xl border border-sky-200/60 dark:border-slate-700/70"
                >
                  {/* Avatar + Name — min-w-0 lets long usernames truncate
                      instead of pushing the net badge off-screen */}
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-100 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-xs sm:text-sm flex-shrink-0 border border-sky-200 dark:border-slate-600">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        @{username}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        Paid ₹{Number(balance.paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
                        Owes ₹{Number(balance.owes || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Net */}
                  <span
                    className={`text-xs sm:text-sm font-extrabold flex-shrink-0 px-2 sm:px-2.5 py-1 rounded-lg whitespace-nowrap ${
                      net > 0
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        : net < 0
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {formatINR(net)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==========================================================
          SETTLEMENT INSTRUCTIONS
      ========================================================== */}
      {settlements.settlements && settlements.settlements.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-sky-200/80 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Settlement Instructions
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Optimal transactions to resolve all group debts with minimum payments
              </p>
            </div>
            <span className="self-start sm:self-auto text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 flex-shrink-0 whitespace-nowrap">
              {settlements.settlements.length} payment{settlements.settlements.length === 1 ? '' : 's'} required
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {settlements.settlements.map((settlement, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.18 }}
                className="group flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200/80 bg-sky-50/60 p-2.5 shadow-xs transition-all duration-200 hover:border-sky-400 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-sky-600 sm:gap-3 sm:p-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-100 text-[10px] font-extrabold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300 sm:h-9 sm:w-9 sm:rounded-xl">
                    {(settlement.from || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">From</p>
                    <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900 dark:text-white sm:text-sm">
                      @{settlement.from}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <FaArrowRight className="h-3 w-3 text-sky-500 transition-transform group-hover:translate-x-0.5 dark:text-sky-400" />
                  <span className="whitespace-nowrap rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-black text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 sm:text-sm">
                    ₹{Number(settlement.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2.5">
                  <div className="min-w-0 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">To</p>
                    <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900 dark:text-white sm:text-sm">
                      @{settlement.to}
                    </p>
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100 text-[10px] font-extrabold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300 sm:h-9 sm:w-9 sm:rounded-xl">
                    {(settlement.to || '?').charAt(0).toUpperCase()}
                  </div>
                </div>
                {settlement.activePayment && (
                  <p className="w-full text-right text-[11px] font-medium text-violet-700 dark:text-violet-300">Payment in progress: ₹{((settlement.activePayment.amount_paise ?? Math.round(Number(settlement.activePayment.amount || 0) * 100)) / 100).toFixed(2)} ({settlement.activePayment.from_username} → {settlement.activePayment.to_username})</p>
                )}
                {user?.username === settlement.from && settlement.receiverUpiId && !settlement.activePayment && (
                  <button onClick={() => beginPayment(settlement)} disabled={openingSettlement === settlement}
                    className="btn-primary ml-auto w-full py-2 text-xs sm:ml-0 sm:w-auto sm:px-4">
                    {openingSettlement === settlement ? 'Preparing…' : `Pay ₹${Number(settlement.amount).toFixed(2)}`}
                  </button>
                )}
                {user?.username === settlement.from && !settlement.receiverUpiId && (
                  <p className="w-full text-right text-[11px] font-medium text-amber-700 dark:text-amber-300">@{settlement.to} has not added a UPI ID yet.</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-sky-200/80 dark:border-slate-700 p-6 sm:p-8 text-center shadow-sm">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <FaRupeeSign className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            All Settled Up!
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Everyone has paid their exact share. There are no pending debts or transfers needed.
          </p>
        </div>
      )}
      {upiPayment && <UpiPaymentModal payment={upiPayment} onClose={() => setUpiPayment(null)} onUpdated={loadSettlements} />}
    </div>
  );
};

export default SettlementsTab;

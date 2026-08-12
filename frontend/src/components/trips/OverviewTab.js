// src/components/trips/OverviewTab.js
import React, { useState, useEffect } from 'react';
import { FaUsers, FaReceipt, FaHourglassHalf } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { settlementsAPI, expensesAPI } from '../../services/api';

export const OverviewTab = ({ tripId, trip, onSwitchTab }) => {
  const [summary, setSummary] = useState({
    totalSpent: 0,
    expenseCount: 0,
    memberCount: 0,
    balances: {},
    pendingSettlements: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        setLoading(true);
        const [settleRes, expRes] = await Promise.all([
          settlementsAPI.getTripSettlements(tripId),
          expensesAPI.getTripExpenses(tripId),
        ]);

        const balances = settleRes.data?.balances || {};
        const settlements = settleRes.data?.settlements || [];
        const expenses = expRes.data || [];

        const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        setSummary({
          totalSpent,
          expenseCount: expenses.length,
          memberCount: Object.keys(balances).length,
          balances,
          pendingSettlements: settlements.length,
        });
      } catch (err) {
        console.error('Failed to load overview:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [tripId]);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Loading overview metrics…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between hover:border-primary-300 transition-colors">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Expenses</span>
            <FaReceipt className="h-4 w-4 text-primary-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary.expenseCount}</p>
          <button
            onClick={() => onSwitchTab('expenses')}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold mt-2 text-left cursor-pointer"
          >
            View Expenses →
          </button>
        </div>

        <div className="card p-4 flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Members</span>
            <FaUsers className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary.memberCount}</p>
          <button
            onClick={() => onSwitchTab('members')}
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold mt-2 text-left cursor-pointer"
          >
            View Members →
          </button>
        </div>

        <div className="card p-4 flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold">Settlements</span>
            <FaHourglassHalf className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary.pendingSettlements}</p>
          <button
            onClick={() => onSwitchTab('settlements')}
            className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold mt-2 text-left cursor-pointer"
          >
            Settle Debts →
          </button>
        </div>

        {/* AI Assistant Card - Clean Sky Theme */}
        <div className="card p-4 flex flex-col justify-between bg-gradient-to-br from-primary-50 via-sky-50 to-white dark:from-primary-950/50 dark:via-gray-800 dark:to-gray-800 border-primary-200 dark:border-primary-800/60 shadow-sm">
          <div className="flex items-center justify-between text-primary-700 dark:text-primary-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <HiSparkles className="h-4 w-4 text-primary-600 dark:text-primary-400" /> AI Copilot
            </span>
            <span className="text-[10px] font-bold bg-primary-600 text-white px-1.5 py-0.5 rounded-full">Gemini</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">Ask instant questions about trip spending & balances</p>
          <button
            onClick={() => onSwitchTab('copilot')}
            className="text-xs text-primary-700 hover:text-primary-800 dark:text-primary-300 font-bold mt-2 text-left flex items-center gap-1 cursor-pointer"
          >
            Open Copilot →
          </button>
        </div>
      </div>

      {/* Member Balances Summary Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FaUsers className="h-4 w-4 text-primary-500" />
            Member Balances
          </h3>
          <button
            onClick={() => onSwitchTab('spending')}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold cursor-pointer"
          >
            View Full Breakdown
          </button>
        </div>

        {Object.keys(summary.balances).length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No balances calculated yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(summary.balances).map(([username, b]) => {
              const net = (b.paid || 0) - (b.owes || 0);
              return (
                <div
                  key={username}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">@{username}</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {net >= 0 ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default OverviewTab;

// src/pages/TripDetail.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { tripsAPI, expensesAPI } from '../services/api';
import { ExpensesTab } from '../components/trips/ExpensesTab';
import { MembersTab } from '../components/trips/MembersTab';
import { PlacesTab } from '../components/trips/PlacesTab';
import { AnalyticsTab } from '../components/trips/AnalyticsTab';
import { SpendingTab } from '../components/trips/SpendingTab';
import { SettlementsTab } from '../components/trips/SettlementsTab';
import { PaymentsTab } from '../components/trips/PaymentsTab';
import { AICopilotTab } from '../components/trips/AICopilotTab';
import { FaArrowLeft, FaTrash, FaMapMarkerAlt, FaCalendarAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';

const tabs = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'settlements', label: 'Settlements' },
  { id: 'payments', label: 'Payments' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'spending', label: 'Spending' },
  { id: 'members', label: 'Members' },
  { id: 'places', label: 'Places / Timeline' },
];

export const TripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [activeTab, setActiveTab] = useState('expenses');
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tripStats, setTripStats] = useState({ totalSpent: 0, expenseCount: 0 });
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(() => {
    if (!id) return false;

    try {
      const saved = localStorage.getItem(`trip-overview-expanded-${id}`);
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      return false;
    }
  });

  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');

  // Ref map for horizontal scrolling tab items into view
  const tabRefs = useRef({});
  const navContainerRef = useRef(null);

  // Silently refresh data on real-time updates without showing notifications
  const handleRealtimeExpenseAdded = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleRealtimeExpenseDeleted = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleRealtimeSettlementUpdated = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useSocket(id, handleRealtimeExpenseAdded, handleRealtimeExpenseDeleted, handleRealtimeSettlementUpdated);

  // Switch tab listener
  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-trip-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-trip-tab', handleSwitchTab);
  }, []);

  // Broadcast active tab & AI modal visibility to the floating trigger and tab strip
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('copilot-tab-visible', { detail: aiPanelOpen }));
    window.dispatchEvent(new CustomEvent('active-tab-changed', { detail: activeTab }));

    const activeEl = tabRefs.current[activeTab];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab, aiPanelOpen]);

  useEffect(() => {
    const handleOpenAi = () => setAiPanelOpen(true);
    const handleCloseAi = () => setAiPanelOpen(false);

    window.addEventListener('open-ai-copilot', handleOpenAi);
    window.addEventListener('close-ai-copilot', handleCloseAi);

    return () => {
      window.removeEventListener('open-ai-copilot', handleOpenAi);
      window.removeEventListener('close-ai-copilot', handleCloseAi);
    };
  }, []);

  const loadTrip = useCallback(async () => {
    try {
      setLoading(true);
      const [tripRes, expensesRes] = await Promise.all([
        tripsAPI.getById(id),
        expensesAPI.getTripExpenses(id).catch(() => ({ data: [] })),
      ]);

      setTrip(tripRes.data);

      const exps = expensesRes.data || [];
      const totalSpent = exps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      setTripStats({
        totalSpent,
        expenseCount: exps.length,
      });
    } catch (error) {
      toast.error('Failed to load trip details');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip, refreshKey]);

  useEffect(() => {
    if (!id) return;
    try {
      localStorage.setItem(`trip-overview-expanded-${id}`, JSON.stringify(overviewExpanded));
    } catch (error) {
      // ignore storage issues gracefully
    }
  }, [id, overviewExpanded]);

  const handleDeleteTrip = async () => {
    if (!trip) return;
    if (confirmValue.trim() !== trip.name.trim()) {
      toast.error('Trip name does not match confirmation text.');
      return;
    }
    try {
      setDeleting(true);
      await tripsAPI.delete(id);
      toast.success('Trip deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to delete trip');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !trip) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-500 dark:text-gray-400 text-sm">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Loading trip details…
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="space-y-4 pb-16">

      <div className="sticky top-16 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 pt-1 pb-2 space-y-2">
        <div className="bg-gradient-to-r from-sky-100 via-sky-50 to-blue-100 dark:bg-gradient-to-br dark:from-primary-900 dark:to-slate-900 text-slate-900 dark:text-white border border-sky-200/90 dark:border-none shadow-sm relative overflow-hidden rounded-2xl transition-colors duration-200">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none hidden dark:block" />

          <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center rounded-full border border-sky-300/80 bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-sky-900 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-primary-200">
                Overview
              </span>
              <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{trip.name}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(`/groups/${trip.group_id}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-sky-800 transition-colors hover:bg-white hover:text-sky-950 dark:border-white/10 dark:bg-white/10 dark:text-primary-200 dark:hover:bg-white/20 dark:hover:text-white cursor-pointer"
              >
                <FaArrowLeft className="h-3 w-3 text-sky-600 dark:text-primary-400" /> Back to Group
              </button>

              <button
                type="button"
                onClick={() => setOverviewExpanded((prev) => !prev)}
                aria-expanded={overviewExpanded}
                aria-label={overviewExpanded ? 'Collapse trip overview' : 'Expand trip overview'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200/80 bg-white/70 text-sky-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${overviewExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9.5l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {overviewExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="relative z-10 border-t border-sky-200/80 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4 dark:border-white/10">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-sky-200/80 text-xs dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-sky-300/80 bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-sky-900 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-primary-200">
                        Trip Overview
                      </span>
                      {trip.group_name && (
                        <span className="text-xs text-sky-800 dark:text-gray-300 font-semibold">in {trip.group_name}</span>
                      )}
                    </div>

                    {user && trip.created_by === user.username && (
                      <button
                        onClick={() => setConfirmOpen(true)}
                        className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FaTrash className="h-2.5 w-2.5" /> Delete Trip
                      </button>
                    )}
                  </div>

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2.5xl">
                        {trip.name}
                      </h1>
                      {trip.description && (
                        <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5 max-w-xl line-clamp-1 font-medium">{trip.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3.5 mt-2 text-[11px] text-slate-700 dark:text-gray-300 font-semibold">
                        {trip.location && (
                          <div className="flex items-center gap-1.5">
                            <FaMapMarkerAlt className="text-sky-600 dark:text-primary-400" /> {trip.location}
                          </div>
                        )}
                        {trip.start_date && (
                          <div className="flex items-center gap-1.5">
                            <FaCalendarAlt className="text-sky-600 dark:text-primary-400" />
                            {new Date(trip.start_date).toLocaleDateString('en-IN')}
                            {trip.end_date && ` - ${new Date(trip.end_date).toLocaleDateString('en-IN')}`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-row items-center justify-between rounded-2xl border border-sky-200 bg-white/90 px-3.5 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md sm:flex-col sm:items-end sm:justify-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wide text-slate-500 dark:text-gray-300 block text-left sm:text-right">Total Trip Spent</span>
                        <span className="text-lg sm:text-xl font-black text-sky-700 dark:text-white mt-0.5 block">
                          ₹{tripStats.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold mt-1 bg-sky-600 text-white dark:bg-primary-500/20 dark:text-primary-300 px-2.5 py-0.5 rounded-full dark:border dark:border-primary-500/30">
                        {tripStats.expenseCount} expense{tripStats.expenseCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tab Navigation Strip — solid, with sliding bubble animation via framer-motion layoutId */}
        <div className="mt-3 rounded-[20px] border border-sky-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <nav
            ref={navContainerRef}
            className="relative flex space-x-1 overflow-x-auto px-1 py-0.5 no-scrollbar"
            aria-label="Trip Tabs"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => (tabRefs.current[tab.id] = el)}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 sm:text-sm cursor-pointer ${active
                    ? tab.highlight
                      ? 'text-white'
                      : 'text-sky-700 dark:text-sky-200'
                    : tab.highlight
                      ? 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                >
                  {/* Sliding animated background bubble */}
                  {active && (
                    <motion.span
                      layoutId="active-tab-bubble"
                      className={`absolute inset-0 rounded-xl ${tab.highlight
                        ? 'bg-gradient-to-r from-sky-600 to-primary-600 shadow-md shadow-primary-600/30'
                        : 'border border-sky-200 bg-sky-100 dark:border-slate-600 dark:bg-slate-700'
                        }`}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

      </div>

      <motion.div
        key={`${activeTab}-${refreshKey}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="pt-1"
      >
        {activeTab === 'expenses' && <ExpensesTab tripId={id} key={`exp-${refreshKey}`} />}
        {activeTab === 'settlements' && <SettlementsTab tripId={id} key={`stl-${refreshKey}`} />}
        {activeTab === 'payments' && <PaymentsTab tripId={id} key={`pym-${refreshKey}`} />}
        {activeTab === 'analytics' && <AnalyticsTab tripId={id} key={`ana-${refreshKey}`} />}
        {activeTab === 'spending' && <SpendingTab tripId={id} key={`spn-${refreshKey}`} />}
        {activeTab === 'members' && <MembersTab tripId={id} trip={trip} key={`mem-${refreshKey}`} />}
        {activeTab === 'places' && <PlacesTab tripId={id} key={`plc-${refreshKey}`} />}
      </motion.div>

      <AnimatePresence>
        {aiPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setAiPanelOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, x: 32, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 26, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="absolute inset-x-0 bottom-0 top-auto h-[88vh] w-full rounded-t-[28px] overflow-hidden bg-transparent shadow-2xl sm:inset-auto sm:right-0 sm:top-0 sm:h-full sm:w-[58vw] sm:max-w-[720px] sm:rounded-none sm:rounded-l-[28px] sm:rounded-r-[0px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-full w-full sm:h-[86vh] sm:mt-[7vh] sm:mr-4 sm:rounded-[28px] overflow-hidden">
                <AICopilotTab tripId={id} isPopup onClose={() => setAiPanelOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Trip</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This action cannot be undone. Type <span className="font-bold text-gray-900 dark:text-white">{trip.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              className="input-field mt-4"
              placeholder={trip.name}
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn-secondary flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
                disabled={deleting || confirmValue.trim() !== trip.name.trim()}
                className="btn-danger flex-1 cursor-pointer"
              >
                {deleting ? 'Deleting…' : 'Delete Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripDetail;

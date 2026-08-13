// src/components/FloatingAICopilotButton.js
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiSparkles } from 'react-icons/hi2';
import { FaPlus, FaCamera } from 'react-icons/fa';

export const FloatingAICopilotButton = () => {
  const location = useLocation();
  const [tooltip, setTooltip] = useState(false);
  const [copilotVisible, setCopilotVisible] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  // Track active tab to adjust positioning when Expenses FAB is present
  const [activeTab, setActiveTab] = useState('overview');

  // Hide when the AI Copilot tab is currently active
  useEffect(() => {
    const handleVisibility = (e) => setCopilotVisible(!!e.detail);
    window.addEventListener('copilot-tab-visible', handleVisibility);
    return () => window.removeEventListener('copilot-tab-visible', handleVisibility);
  }, []);

  // Track active tab for smart positioning (listen to TripDetail broadcasts)
  useEffect(() => {
    const handleTabChanged = (e) => {
      if (e.detail) setActiveTab(e.detail);
    };
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    const handleExpenseModalOpen = () => setExpenseModalOpen(true);
    const handleExpenseModalClosed = () => setExpenseModalOpen(false);

    window.addEventListener('active-tab-changed', handleTabChanged);
    window.addEventListener('resize', handleResize);
    window.addEventListener('expense-modal-open', handleExpenseModalOpen);
    window.addEventListener('expense-modal-closed', handleExpenseModalClosed);
    handleResize();

    return () => {
      window.removeEventListener('active-tab-changed', handleTabChanged);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('expense-modal-open', handleExpenseModalOpen);
      window.removeEventListener('expense-modal-closed', handleExpenseModalClosed);
    };
  }, []);

  // Hide on auth / landing pages and only show on trip pages
  const hiddenPaths = ['/', '/login', '/register', '/reset-password', '/dashboard'];
  const isTripPage = location.pathname.startsWith('/trips/');

  if (hiddenPaths.includes(location.pathname) || !isTripPage) return null;

  // Hide the entire floating button stack whenever the add-expense modal is open.
  if (copilotVisible || expenseModalOpen) return null;

  // On mobile, keep the relevant quick-add action stacked above AI.
  const isExpensesTab = activeTab === 'expenses';
  const isPlacesTab = activeTab === 'places';

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-ai-copilot'));
  };

  const handlePlaceClick = () => {
    window.dispatchEvent(new CustomEvent('open-place-form'));
    window.dispatchEvent(new CustomEvent('switch-trip-tab', { detail: 'places' }));
  };

  const handleExpenseClick = () => {
    window.dispatchEvent(new CustomEvent('open-expense-form'));
    window.dispatchEvent(new CustomEvent('switch-trip-tab', { detail: 'expenses' }));
  };

  const mobileStackOffset = 'bottom-4';

  return (
    <div
      className={`fixed z-50 flex flex-col items-end gap-3 ${
        isMobile ? `${mobileStackOffset} right-4 sm:bottom-6 sm:right-6` : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
      }`}
    >
      {/* Tooltip — shown on the correct side */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="relative bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap border border-gray-700/50 dark:border-gray-600"
          >
            AI Copilot
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile && isPlacesTab && (
        <motion.button
          onClick={handlePlaceClick}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          aria-label="Quick add place"
          title="Quick add place"
          className="relative flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 border border-emerald-500/30 text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer"
          style={{ width: '52px', height: '52px' }}
        >
          <FaCamera className="h-4 w-4" />
        </motion.button>
      )}

      {isMobile && isExpensesTab && !expenseModalOpen && (
        <motion.button
          onClick={handleExpenseClick}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          aria-label="Quick add expense"
          title="Quick add expense"
          className="relative flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/30 hover:shadow-primary-600/40 border border-primary-500/30 text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 cursor-pointer"
          style={{ width: '52px', height: '52px' }}
        >
          <FaPlus className="h-4 w-4" />
        </motion.button>
      )}

      {/* Button */}
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        aria-label="Open AI Copilot"
        className="relative flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/30 hover:shadow-primary-600/40 border border-primary-500/30 text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 cursor-pointer"
        style={{ width: '52px', height: '52px' }}
      >
        <HiSparkles style={{ width: '22px', height: '22px' }} />

        {/* Live pulse dot */}
        <span className="absolute top-0.5 right-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
        </span>
      </motion.button>
    </div>
  );
};

export default FloatingAICopilotButton;

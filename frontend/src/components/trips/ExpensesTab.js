// src/components/trips/ExpensesTab.js

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  motion,
  AnimatePresence,
} from 'framer-motion';

import toast from 'react-hot-toast';

import {
  FaPlus,
  FaTrash,
  FaRupeeSign,
  FaUsers,
  FaChevronDown,
  FaReceipt,
  FaEquals,
  FaCoins,
  FaPercent,
  FaPiggyBank,
  FaSlidersH,
  FaListUl,
} from 'react-icons/fa';

import {
  expensesAPI,
  tripsAPI,
  paymentsAPI,
} from '../../services/api';

import { AddExpenseModal } from './AddExpenseModal';

/* ============================================================
   HELPERS
============================================================ */

const formatINR = (val) => {
  const n = Number(val);

  if (!Number.isFinite(n)) {
    return '₹0.00';
  }

  return n.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
};


/* ============================================================
   SAFE USER
============================================================ */

const SafeJSONUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem('user') || 'null'
    );
  } catch {
    return null;
  }
};


/* ============================================================
   AVATAR
============================================================ */

const Avatar = ({
  name = '',
  size = 44,
}) => {
  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="
        flex
        shrink-0
        items-center
        justify-center
        rounded-2xl
        bg-gradient-to-br
        from-indigo-500
        to-fuchsia-500
        font-semibold
        text-white
        shadow-sm
      "
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: Math.round(size / 2.4),
        }}
      >
        {initials}
      </span>
    </div>
  );
};


const getSplitBadgeMeta = (splitType) => {
  const key = splitType || 'EQUAL';

  const map = {
    EQUAL: {
      label: 'Equal',
      icon: FaEquals,
      className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    },
    EXACT: {
      label: 'Exact',
      icon: FaCoins,
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    },
    PERCENTAGE: {
      label: 'Percent',
      icon: FaPercent,
      className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    },
    SHARES: {
      label: 'Shares',
      icon: FaPiggyBank,
      className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    },
    ADJUSTMENT: {
      label: 'Adjust',
      icon: FaSlidersH,
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    ITEMIZED: {
      label: 'Items',
      icon: FaListUl,
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    },
  };

  return map[key] || map.EQUAL;
};


/* ============================================================
   COMPONENT
============================================================ */

export const ExpensesTab = ({ tripId }) => {

  /* ==========================================================
     STATE
  ========================================================== */

  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [showModal, setShowModal] =
    useState(false);

  const [members, setMembers] =
    useState([]);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [targetExpense, setTargetExpense] =
    useState(null);

  const [deleting, setDeleting] =
    useState(false);

  /*
   * Multiple cards can be expanded on mobile and desktop.
   */
  const [expandedIds, setExpandedIds] =
    useState([]);


  /* ==========================================================
     CURRENT USER
  ========================================================== */

  const currentUser = useMemo(
    () => SafeJSONUser(),
    []
  );


  /* ==========================================================
     LOAD MEMBERS
  ========================================================== */

  const loadMembers = useCallback(
    async () => {
      if (!tripId) return;

      try {
        const membersRes =
          await tripsAPI.getMembers(
            tripId
          );

        setMembers(
          membersRes?.data || []
        );
      } catch (error) {
        console.error(
          'Failed to load members',
          error
        );
      }
    },
    [tripId]
  );


  /* ==========================================================
     LOAD EXPENSES
  ========================================================== */

  const loadExpenses = useCallback(
    async () => {
      if (!tripId) return;

      try {
        setLoading(true);

        const response =
          await expensesAPI.getTripExpenses(
            tripId
          );

        const data =
          Array.isArray(response?.data)
            ? response.data
            : [];

        setExpenses(data);
      } catch (error) {
        console.error(
          'Failed to load expenses',
          error
        );

        toast.error(
          'Failed to load expenses'
        );
      } finally {
        setLoading(false);
      }
    },
    [tripId]
  );


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    loadExpenses();
    loadMembers();
  }, [
    loadExpenses,
    loadMembers,
  ]);


  /* ==========================================================
     GLOBAL ADD EXPENSE EVENT
  ========================================================== */

  useEffect(() => {
    const handleOpenExpenseForm = () => {
      setShowModal(true);
    };

    window.addEventListener(
      'open-expense-form',
      handleOpenExpenseForm
    );

    return () => {
      window.removeEventListener(
        'open-expense-form',
        handleOpenExpenseForm
      );
    };
  }, []);


  /* ==========================================================
     DELETE CONFIRMATION
  ========================================================== */

  const openDeleteConfirm = (expense) => {
    setTargetExpense(expense);
    setConfirmOpen(true);
  };


  /* ==========================================================
     CLOSE DELETE MODAL
  ========================================================== */

  const closeDeleteConfirm = () => {
    if (deleting) return;

    setConfirmOpen(false);
    setTargetExpense(null);
  };


  /* ==========================================================
     DELETE EXPENSE
  ========================================================== */

  const handleDelete = async () => {
    if (!targetExpense || deleting) {
      return;
    }

    try {
      setDeleting(true);

      await expensesAPI.delete(
        targetExpense.id
      );

      toast.success(
        'Expense deleted'
      );

      /*
       * Remove it from expanded cards.
       */
      setExpandedIds((previous) =>
        previous.filter(
          (id) =>
            id !== targetExpense.id
        )
      );

      setConfirmOpen(false);
      setTargetExpense(null);

      await loadExpenses();

      /*
       * Preserve your existing payment
       * synchronization logic.
       */
      try {
        await paymentsAPI.reset(
          tripId,
          {
            mode: 'soft',
          }
        );
      } catch (error) {
        console.error(
          'Failed to sync payments after expense delete',
          error
        );
      }

    } catch (error) {
      console.error(
        'Failed to delete expense',
        error
      );

      toast.error(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to delete expense'
      );

    } finally {
      setDeleting(false);
    }
  };


  /* ==========================================================
     TOTAL EXPENSES
  ========================================================== */

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) => {
          const amount =
            parseFloat(
              expense?.amount || 0
            );

          return (
            sum +
            (Number.isFinite(amount)
              ? amount
              : 0)
          );
        },
        0
      ),
    [expenses]
  );


  /* ==========================================================
     TOGGLE EXPANDED CARD
  ========================================================== */

  const toggleExpanded = (id) => {
    setExpandedIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter(
          (item) => item !== id
        );
      }

      return [
        ...previous,
        id,
      ];
    });
  };

  /* ==========================================================
     CALCULATE BREAKDOWN
  ========================================================== */

  const calculateBreakdown = (expense) => {
    const splitData = expense.split_data || {};
    const participants = expense.participants || [];
    const splitType = expense.split_type || 'EQUAL';
    const totalAmount = Number(expense.amount || 0);

    if (!participants.length) {
      return [];
    }

    const breakdown = [];

    if (splitType === 'EQUAL') {
      const perPerson = totalAmount / participants.length;
      participants.forEach((username) => {
        breakdown.push({
          username,
          amount: perPerson,
          percent: (100 / participants.length).toFixed(1),
          share: 1,
          meta: 'Equal share',
        });
      });
    } else if (splitType === 'EXACT') {
      participants.forEach((username) => {
        const amount = Number(splitData[username] || 0);
        breakdown.push({
          username,
          amount,
          percent: ((amount / totalAmount) * 100).toFixed(1),
          meta: `Exact amount · ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
      });
    } else if (splitType === 'PERCENTAGE') {
      participants.forEach((username) => {
        const percent = Number(splitData[username] || 0);
        const amount = (totalAmount * percent) / 100;
        breakdown.push({
          username,
          amount,
          percent: percent.toFixed(1),
          meta: `${percent.toFixed(1)}% of total`,
        });
      });
    } else if (splitType === 'SHARES') {
      const totalShares = participants.reduce(
        (sum, username) =>
          sum + Number(splitData[username] || 0),
        0
      );

      participants.forEach((username) => {
        const share = Number(splitData[username] || 0);
        const amount = (totalAmount * share) / totalShares;
        breakdown.push({
          username,
          amount,
          share: share || 0,
          percent: ((amount / totalAmount) * 100).toFixed(1),
          meta: `${share || 0} shares`,
        });
      });
    } else if (splitType === 'ADJUSTMENT') {
      const adjusted = participants
        .filter(
          (username) =>
            Number(splitData[username] || 0) !== 0
        );
      const unadjusted = participants.filter(
        (username) =>
          Number(splitData[username] || 0) === 0
      );

      const adjustedTotal = adjusted.reduce(
        (sum, username) =>
          sum + Number(splitData[username] || 0),
        0
      );

      const remaining = totalAmount - adjustedTotal;
      const perUnadjusted =
        unadjusted.length > 0
          ? remaining / unadjusted.length
          : 0;

      adjusted.forEach((username) => {
        const amount = Number(splitData[username] || 0);
        breakdown.push({
          username,
          amount,
          percent: ((amount / totalAmount) * 100).toFixed(1),
          isAdjusted: true,
          meta: 'Fixed amount',
        });
      });

      unadjusted.forEach((username) => {
        breakdown.push({
          username,
          amount: perUnadjusted,
          percent: ((perUnadjusted / totalAmount) * 100).toFixed(1),
          isAdjusted: false,
          meta: 'Remaining share',
        });
      });
    } else if (splitType === 'ITEMIZED') {
      const items = splitData.items || [];
      const userItems = {};

      items.forEach((item) => {
        const itemAmount = Number(item.amount || 0);
        const itemParticipants = item.participants || [];

        if (itemParticipants.length > 0) {
          const perPerson = itemAmount / itemParticipants.length;
          itemParticipants.forEach((username) => {
            if (!userItems[username]) {
              userItems[username] = 0;
            }
            userItems[username] += perPerson;
          });
        }
      });

      participants.forEach((username) => {
        const amount = userItems[username] || 0;
        breakdown.push({
          username,
          amount,
          percent: ((amount / totalAmount) * 100).toFixed(1),
          meta: 'Itemized share',
        });
      });
    }

    return breakdown.sort((a, b) =>
      a.username.localeCompare(b.username)
    );
  };


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="py-6 sm:py-8">

        <div
          className="
            mb-6
            h-10
            w-40
            animate-pulse
            rounded-xl
            bg-slate-200
            dark:bg-slate-800
          "
        />

        <div
          className="
            grid
            grid-cols-1
            gap-4
            lg:grid-cols-2
          "
        >
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="
                  h-36
                  animate-pulse
                  rounded-3xl
                  bg-slate-100
                  dark:bg-slate-800
                "
              />
            )
          )}
        </div>

      </div>
    );
  }


  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <div className="relative w-full">


      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        className="
          mb-6
          sm:mb-8
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          {/* ==================================================
              TITLE
          ================================================== */}

          <div
            className="
              min-w-0
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  bg-primary-100
                  text-primary-600
                  dark:bg-primary-950/50
                  dark:text-primary-400
                "
              >
                <FaReceipt className="h-4 w-4" />
              </div>

              <div className="min-w-0">

                <h2
                  className="
                    text-xl
                    font-bold
                    tracking-tight
                    text-slate-900
                    dark:text-white
                    sm:text-2xl
                  "
                >
                  Expenses
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                    sm:text-sm
                  "
                >
                  {expenses.length}{' '}
                  {expenses.length === 1
                    ? 'expense'
                    : 'expenses'}{' '}
                  recorded
                </p>

              </div>

            </div>

          </div>


          {/* ==================================================
              TOTAL + ADD
          ================================================== */}

          <div
            className="
              flex
              w-full
              items-center
              justify-between
              gap-3
              sm:w-auto
              sm:justify-end
            "
          >

            {/* TOTAL */}

            <div
              className="
                min-w-0
                rounded-2xl
                border
                border-slate-200
                bg-white
                px-3.5
                py-2.5
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
                sm:px-4
              "
            >

              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.14em]
                  text-slate-400
                  sm:text-[10px]
                "
              >
                Total spent
              </p>

              <p
                className="
                  mt-0.5
                  truncate
                  text-sm
                  font-bold
                  text-primary-600
                  dark:text-primary-400
                  sm:text-base
                "
              >
                {formatINR(
                  totalExpenses
                )}
              </p>

            </div>


            {/* DESKTOP ADD */}

            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              aria-label="Add expense"
              className="
                inline-flex
                shrink-0
                items-center
                justify-center
                gap-1.5
                rounded-xl
                bg-primary-600
                px-2.5
                py-2
                text-[11px]
                font-semibold
                text-white
                shadow-sm
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:bg-primary-700
                hover:shadow-md
                active:scale-[0.98]
                focus:outline-none
                focus:ring-2
                focus:ring-primary-300
                sm:px-4
                sm:py-2.5
                sm:text-sm
              "
            >
              <FaPlus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </button>

          </div>

        </div>

      </div>


      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {expenses.length === 0 ? (

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            flex
            min-h-[340px]
            flex-col
            items-center
            justify-center
            rounded-3xl
            border
            border-dashed
            border-slate-300
            bg-gradient-to-br
            from-primary-50
            via-white
            to-sky-50
            px-6
            text-center
            dark:border-slate-700
            dark:from-primary-950/20
            dark:via-slate-900
            dark:to-sky-950/20
          "
        >

          <div
            className="
              mb-5
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-primary-100
              text-primary-600
              shadow-sm
              dark:bg-primary-950/50
              dark:text-primary-400
            "
          >
            <FaRupeeSign className="h-7 w-7" />
          </div>

          <h3
            className="
              text-lg
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            No expenses yet
          </h3>

          <p
            className="
              mt-2
              max-w-sm
              text-sm
              leading-6
              text-slate-500
              dark:text-slate-400
            "
          >
            Add your first expense to start
            splitting the trip costs.
          </p>

          <button
            type="button"
            onClick={() =>
              setShowModal(true)
            }
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-primary-600
              px-5
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition-all
              hover:-translate-y-0.5
              hover:bg-primary-700
            "
          >
            <FaPlus className="h-3.5 w-3.5" />
            Add First Expense
          </button>

        </motion.div>

      ) : (

        /* ====================================================
           EXPENSE GRID

           Mobile   → 1 column
           Tablet   → 1 column
           Desktop  → 2 columns

           This prevents cramped 2-column tablet cards.
        ==================================================== */

        <div
          className="
            grid
            grid-cols-1
            gap-4
            grid-auto-rows-max
            xl:grid-cols-2
            xl:gap-5
          "
        >

          {expenses.map(
            (expense, index) => {

              const isOwner =
                expense?.payer_username ===
                currentUser?.username;

              const amount =
                parseFloat(
                  expense?.amount || 0
                );

              const isExpanded =
                expandedIds.includes(
                  expense.id
                );

              const splitBadge = getSplitBadgeMeta(
                expense?.split_type || expense?.splitType
              );
              const SplitIcon = splitBadge.icon;

              return (
                <motion.article
                  key={expense.id}
                  initial={{
                    opacity: 0,
                    y: 12,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  layout="position"
                  transition={{
                    duration: 0.3,
                    delay: Math.min(
                      index * 0.035,
                      0.2
                    ),
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                  className="
                    group
                    h-fit
                    overflow-hidden
                    rounded-3xl
                    border
                    border-slate-200
                    bg-white
                    shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)]
                    dark:border-slate-800
                    dark:bg-slate-900
                  "
                  aria-labelledby={`expense-${expense.id}-title`}
                >

                  {/* =================================================
                      CARD CONTENT
                  ================================================= */}

                  <div
                    className="
                      border-l-4
                      border-primary-500
                      p-4
                      sm:p-5
                    "
                  >

                    {/* =================================================
                        HEADER
                    ================================================= */}

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      {/* AVATAR */}

                      <Avatar
                        name={
                          expense.payer_username
                        }
                        size={44}
                      />


                      {/* DESCRIPTION */}

                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >

                        <h3
                          id={`expense-${expense.id}-title`}
                          className="
                            break-words
                            text-[15px]
                            font-bold
                            leading-5
                            text-slate-900
                            dark:text-white
                            sm:text-base
                          "
                        >
                          {expense.description ||
                            'No description'}
                        </h3>

                        <p
                          className="
                            mt-1
                            text-xs
                            text-slate-500
                            dark:text-slate-400
                          "
                        >
                          Paid by{' '}

                          <span
                            className="
                              font-semibold
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            {isOwner
                              ? 'You'
                              : expense.payer_username ||
                                'Unknown'}
                          </span>
                        </p>

                      </div>


                      {/* AMOUNT */}

                      <div
                        className="
                          shrink-0
                          text-right
                        "
                      >

                        <p
                          className="
                            text-base
                            font-extrabold
                            tracking-tight
                            text-primary-600
                            dark:text-primary-400
                            sm:text-lg
                          "
                        >
                          {formatINR(
                            amount
                          )}
                        </p>

                        {/* Desktop date */}

                        <p
                          className="
                            mt-1
                            hidden
                            text-[10px]
                            text-slate-400
                            sm:block
                          "
                        >
                          {expense.timestamp
                            ? new Date(
                                expense.timestamp
                              ).toLocaleDateString(
                                'en-IN',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  timeZone:
                                    'Asia/Kolkata',
                                }
                              )
                            : '—'}
                        </p>

                      </div>

                    </div>


                    {/* =================================================
                        META ROW
                    ================================================= */}

                    <div
                      className="
                        mt-4
                        flex
                        flex-wrap
                        items-center
                        gap-2
                      "
                    >

                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-slate-100
                          px-2.5
                          py-1.5
                          text-[10px]
                          font-semibold
                          text-slate-600
                          dark:bg-slate-800
                          dark:text-slate-300
                        "
                      >
                        <FaUsers className="h-2.5 w-2.5" />

                        {expense.participants
                          ?.length || 0}{' '}

                        {expense.participants
                          ?.length === 1
                          ? 'participant'
                          : 'participants'}
                      </span>


                      {expense.category && (
                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-lg
                            bg-gradient-to-r
                            from-emerald-50
                            to-teal-50
                            px-3
                            py-1.5
                            text-[11px]
                            font-semibold
                            tracking-wide
                            text-emerald-700
                            shadow-sm
                            border
                            border-emerald-200/60
                            hover:shadow-md
                            transition-shadow
                            duration-200
                            dark:from-emerald-950/40
                            dark:to-teal-950/40
                            dark:text-emerald-300
                            dark:border-emerald-800/50
                            dark:hover:shadow-emerald-950/20
                          "
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          {expense.category}
                        </span>
                      )}

                      <span
                        className={`
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          px-2.5
                          py-1.5
                          text-[10px]
                          font-semibold
                          ${splitBadge.className}
                        `}
                      >
                        <SplitIcon className="h-2.5 w-2.5" />
                        {splitBadge.label}
                      </span>

                    </div>


                    {/* =================================================
                        UNIFIED DETAILS & BREAKDOWN

                        Single expandable section for all devices.
                        Shows: Participants, Date, Split Method, Breakdown
                    ================================================= */}

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          toggleExpanded(
                            expense.id
                          )
                        }
                        aria-expanded={
                          isExpanded
                        }
                        aria-controls={`expense-${expense.id}-details`}
                        className="
                          flex
                          w-full
                          items-center
                          justify-between
                          rounded-xl
                          border
                          border-slate-200
                          bg-slate-50
                          px-3
                          py-2.5
                          text-left
                          transition-all
                          duration-200
                          hover:border-primary-200
                          hover:bg-primary-50
                          active:scale-[0.99]
                          focus:outline-none
                          focus:ring-2
                          focus:ring-primary-500/20
                          dark:border-slate-800
                          dark:bg-slate-950/50
                          dark:hover:border-primary-900
                          dark:hover:bg-primary-950/20
                        "
                      >
                        <span
                          className="
                            flex
                            items-center
                            gap-2
                            text-xs
                            font-semibold
                            text-slate-600
                            dark:text-slate-300
                          "
                        >
                          <FaReceipt className="h-3 w-3" />
                          {isExpanded
                            ? 'Hide details'
                            : 'View more'}
                        </span>

                        <FaChevronDown
                          className={`
                            h-2.5
                            w-2.5
                            transition-transform
                            duration-300
                            text-slate-400
                            ${
                              isExpanded
                                ? 'rotate-180'
                                : ''
                            }
                          `}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              y: -8,
                              scale: 0.985,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                            }}
                            exit={{
                              opacity: 0,
                              y: -6,
                              scale: 0.985,
                            }}
                            transition={{
                              duration: 0.22,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div
                              id={`expense-${expense.id}-details`}
                              className="
                                rounded-2xl
                                border
                                border-slate-300
                                bg-slate-100
                                p-3.5
                                shadow-[0_10px_30px_rgba(15,23,42,0.06)]
                                dark:border-slate-700
                                dark:bg-slate-800
                                dark:shadow-[0_12px_32px_rgba(2,6,23,0.35)]
                              "
                            >
                              {/* Participants */}
                              <div className="mb-3 pb-3 border-b border-slate-300 dark:border-slate-700">
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                  Participants
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-700 dark:text-slate-300">
                                  {expense.participants?.length
                                    ? expense.participants.join(', ')
                                    : '—'}
                                </p>
                              </div>

                              {/* Split Type */}
                              <div className="mb-2.5 pb-2.5 border-b border-slate-300 dark:border-slate-700">
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                  Split Method
                                </p>
                                <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {(() => {
                                    const splitType = expense.split_type || 'EQUAL';
                                    const map = {
                                      EQUAL: 'Equally Split',
                                      EXACT: 'Exact Amounts',
                                      PERCENTAGE: 'By Percentage',
                                      SHARES: 'By Shares',
                                      ADJUSTMENT: 'Adjustment',
                                      ITEMIZED: 'Itemized',
                                    };
                                    return map[splitType] || 'Unknown';
                                  })()}
                                </p>
                              </div>

                              {/* Breakdown - Compact */}
                              <div className="space-y-1.5 mb-2">
                                {calculateBreakdown(expense).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="
                                      flex
                                      items-center
                                      justify-between
                                      rounded-xl
                                      border
                                      border-slate-200
                                      bg-white/70
                                      px-2.5
                                      py-2
                                      dark:border-slate-700
                                      dark:bg-slate-900/60
                                    "
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        {item.username}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                        {item.meta || `${item.percent}% of total`}
                                      </p>
                                    </div>

                                    <div className="ml-2 shrink-0 text-right">
                                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        ₹{item.amount.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {item.percent}%
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Total - Compact */}
                              <div className="border-t border-slate-300 pt-2 dark:border-slate-700 flex items-center justify-between text-xs">
                                <p className="font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">
                                  Total
                                </p>
                                <p className="font-bold text-slate-900 dark:text-slate-100">
                                  ₹{Number(expense.amount || 0).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>


                  {/* =================================================
                      CARD FOOTER

                      Delete button is now in normal document flow.
                      It can never overlap content.
                  ================================================= */}

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                      border-t
                      border-slate-100
                      bg-slate-50/60
                      px-4
                      py-3
                      dark:border-slate-800
                      dark:bg-slate-950/40
                      sm:px-5
                    "
                  >

                    <div
                      className="
                        min-w-0
                      "
                    >

                      <span
                        className="
                          text-[10px]
                          font-medium
                          text-slate-400
                        "
                      >
                        Paid by
                      </span>

                      <span
                        className="
                          ml-1.5
                          max-w-[150px]
                          truncate
                          text-xs
                          font-semibold
                          text-slate-600
                          dark:text-slate-300
                        "
                      >
                        {isOwner
                          ? 'You'
                          : expense.payer_username ||
                            'Unknown'}
                      </span>

                    </div>


                    {/* DELETE */}

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          openDeleteConfirm(
                            expense
                          )
                        }
                        aria-label={`Delete expense ${
                          expense.description ||
                          ''
                        }`}
                        title="Delete expense"
                        className="
                          inline-flex
                          shrink-0
                          items-center
                          gap-1.5
                          rounded-lg
                          px-2.5
                          py-1.5
                          text-[11px]
                          font-semibold
                          text-red-500
                          transition-all
                          duration-200
                          hover:bg-red-50
                          hover:text-red-600
                          active:scale-95
                          focus:outline-none
                          focus:ring-2
                          focus:ring-red-500/20
                          dark:text-red-400
                          dark:hover:bg-red-950/30
                        "
                      >
                        <FaTrash className="h-3 w-3" />
                        Delete
                      </button>
                    )}

                  </div>

                </motion.article>
              );
            }
          )}

        </div>
      )}


      {/* ======================================================
          ADD EXPENSE MODAL
      ====================================================== */}

      <AddExpenseModal
        isOpen={showModal}
        onClose={() =>
          setShowModal(false)
        }
        onSuccess={loadExpenses}
        tripId={tripId}
        members={members}
      />


      {/* ======================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="
              fixed
              inset-0
              z-[100]
              flex
              items-center
              justify-center
              bg-slate-950/50
              px-4
              backdrop-blur-sm
            "
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeDeleteConfirm();
              }
            }}
          >

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 12,
                scale: 0.97,
              }}
              transition={{
                duration: 0.22,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              className="
                w-full
                max-w-md
                overflow-hidden
                rounded-3xl
                border
                border-slate-200
                bg-white
                shadow-[0_30px_80px_-25px_rgba(15,23,42,0.45)]
                dark:border-slate-700
                dark:bg-slate-900
              "
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-expense-title"
            >

              {/* ==================================================
                  MODAL HEADER
              ================================================== */}

              <div
                className="
                  flex
                  items-start
                  gap-3
                  border-b
                  border-slate-100
                  px-5
                  py-5
                  dark:border-slate-800
                  sm:px-6
                "
              >

                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    bg-red-50
                    text-red-600
                    dark:bg-red-950/40
                    dark:text-red-400
                  "
                >
                  <FaTrash className="h-4 w-4" />
                </div>

                <div className="min-w-0">

                  <h3
                    id="delete-expense-title"
                    className="
                      text-base
                      font-bold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    Delete expense?
                  </h3>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    This action cannot be undone.
                  </p>

                </div>

              </div>


              {/* ==================================================
                  EXPENSE PREVIEW
              ================================================== */}

              {targetExpense && (
                <div
                  className="
                    mx-5
                    mt-5
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                    dark:border-slate-800
                    dark:bg-slate-950/60
                    sm:mx-6
                  "
                >

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-4
                    "
                  >

                    <div className="min-w-0">

                      <p
                        className="
                          break-words
                          text-sm
                          font-semibold
                          text-slate-800
                          dark:text-slate-200
                        "
                      >
                        {targetExpense.description ||
                          'No description'}
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-500
                          dark:text-slate-400
                        "
                      >
                        Paid by{' '}
                        {targetExpense.payer_username ||
                          'Unknown'}
                      </p>

                    </div>

                    <p
                      className="
                        shrink-0
                        text-sm
                        font-bold
                        text-primary-600
                        dark:text-primary-400
                      "
                    >
                      {formatINR(
                        targetExpense.amount
                      )}
                    </p>

                  </div>

                </div>
              )}


              {/* ==================================================
                  MODAL ACTIONS
              ================================================== */}

              <div
                className="
                  flex
                  flex-col-reverse
                  gap-2
                  px-5
                  py-5
                  sm:flex-row
                  sm:justify-end
                  sm:px-6
                "
              >

                <button
                  type="button"
                  onClick={
                    closeDeleteConfirm
                  }
                  disabled={deleting}
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-slate-700
                    transition-colors
                    hover:bg-slate-50
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-slate-200
                    dark:hover:bg-slate-800
                    sm:w-auto
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="
                    inline-flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-red-600
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    shadow-sm
                    transition-all
                    hover:bg-red-700
                    active:scale-[0.98]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    sm:w-auto
                  "
                >

                  {deleting ? (
                    <>
                      <span
                        className="
                          h-3.5
                          w-3.5
                          animate-spin
                          rounded-full
                          border-2
                          border-white/40
                          border-t-white
                        "
                      />

                      Deleting…
                    </>
                  ) : (
                    <>
                      <FaTrash className="h-3 w-3" />
                      Delete Expense
                    </>
                  )}

                </button>

              </div>

            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ExpensesTab;
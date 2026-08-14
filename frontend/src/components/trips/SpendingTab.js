// src/components/trips/SpendingTab.js

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { motion } from 'framer-motion';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import toast from 'react-hot-toast';

import {
  FaUsers,
  FaWallet,
  FaArrowUp,
  FaArrowDown,
  FaBalanceScale,
  FaChartBar,
} from 'react-icons/fa';

import { settlementsAPI } from '../../services/api';


/* ============================================================
   HELPERS
============================================================ */

const formatINR = (val) =>
  Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


const formatCompactINR = (val) => {
  const value = Number(val || 0);

  if (!Number.isFinite(value)) {
    return '₹0';
  }

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(value)}`;
};


const formatUsername = (username = '') => {
  if (!username) {
    return 'User';
  }

  return username.length > 16
    ? `${username.slice(0, 16)}…`
    : username;
};


/* ============================================================
   CUSTOM TOOLTIP
============================================================ */

const SpendingTooltip = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  const value =
    Number(payload[0]?.value || 0);

  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        px-3.5
        py-3
        shadow-xl
        dark:border-slate-700
        dark:bg-slate-900
      "
    >
      <p
        className="
          max-w-[180px]
          truncate
          text-xs
          font-semibold
          text-slate-700
          dark:text-slate-200
        "
      >
        @{label}
      </p>

      <p
        className="
          mt-1
          text-sm
          font-bold
          text-sky-600
          dark:text-sky-400
        "
      >
        ₹{formatINR(value)}
      </p>
    </div>
  );
};


/* ============================================================
   SUMMARY CARD
============================================================ */

const SummaryCard = ({
  icon: Icon,
  label,
  value,
  description,
  iconClass,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 16,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.35,
        delay,
        ease: [
          0.22,
          1,
          0.36,
          1,
        ],
      }}
      className="
        relative
        overflow-hidden
        rounded-3xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:shadow-[0_18px_40px_-25px_rgba(15,23,42,0.5)]
        dark:border-slate-800
        dark:bg-slate-900
        sm:p-5
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -right-8
          -top-8
          h-24
          w-24
          rounded-full
          bg-sky-100/60
          blur-2xl
          dark:bg-sky-950/30
        "
      />

      <div
        className="
          relative
          flex
          items-start
          justify-between
          gap-3
        "
      >

        <div className="min-w-0">

          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.14em]
              text-slate-400
              sm:text-[11px]
            "
          >
            {label}
          </p>

          <p
            className="
              mt-1.5
              truncate
              text-xl
              font-extrabold
              tracking-tight
              text-slate-900
              dark:text-white
              sm:text-2xl
            "
          >
            {value}
          </p>

          {description && (
            <p
              className="
                mt-1
                text-[11px]
                text-slate-400
                sm:text-xs
              "
            >
              {description}
            </p>
          )}

        </div>

        <div
          className={`
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-2xl
            sm:h-11
            sm:w-11
            ${iconClass}
          `}
        >
          <Icon className="h-4 w-4" />
        </div>

      </div>

    </motion.div>
  );
};


/* ============================================================
   MEMBER AVATAR
============================================================ */

const MemberAvatar = ({
  username = '',
  size = 'normal',
}) => {
  const initials =
    username
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const sizeClass =
    size === 'large'
      ? 'h-11 w-11 text-sm'
      : 'h-9 w-9 text-xs';

  return (
    <div
      className={`
        flex
        shrink-0
        items-center
        justify-center
        rounded-2xl
        bg-gradient-to-br
        from-sky-500
        to-indigo-600
        font-bold
        text-white
        shadow-sm
        ${sizeClass}
      `}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
};


/* ============================================================
   MEMBER MOBILE CARD
============================================================ */

const MemberMobileCard = ({
  row,
  index,
}) => {
  const isPositive = row.net >= 0;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.3,
        delay: index * 0.04,
      }}
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-[0_8px_25px_-20px_rgba(15,23,42,0.5)]
        dark:border-slate-800
        dark:bg-slate-900
      "
    >

      {/* Member header */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >

        <div
          className="
            flex
            min-w-0
            items-center
            gap-3
          "
        >

          <MemberAvatar
            username={row.username}
            size="large"
          />

          <div className="min-w-0">

            <p
              className="
                truncate
                text-sm
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              @{formatUsername(
                row.username
              )}
            </p>

            <p
              className="
                mt-0.5
                text-[11px]
                text-slate-400
              "
            >
              Member {index + 1}
            </p>

          </div>

        </div>


        <div
          className={`
            shrink-0
            rounded-full
            px-2.5
            py-1
            text-[10px]
            font-bold
            ${
              isPositive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }
          `}
        >
          {isPositive
            ? 'Receives'
            : 'Pays'}
        </div>

      </div>


      {/* Main net */}

      <div
        className="
          mt-4
          rounded-2xl
          bg-slate-50
          p-3
          dark:bg-slate-800/70
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >

          <div>

            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                text-slate-400
              "
            >
              Net balance
            </p>

            <p
              className={`
                mt-1
                text-lg
                font-extrabold
                ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }
              `}
            >
              {isPositive
                ? '+'
                : '-'}
              ₹
              {formatINR(
                Math.abs(row.net)
              )}
            </p>

          </div>

          <div
            className={`
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              ${
                isPositive
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
              }
            `}
          >
            {isPositive ? (
              <FaArrowUp className="h-3.5 w-3.5" />
            ) : (
              <FaArrowDown className="h-3.5 w-3.5" />
            )}
          </div>

        </div>

      </div>


      {/* Breakdown */}

      <div
        className="
          mt-3
          grid
          grid-cols-2
          gap-2
        "
      >

        <div
          className="
            rounded-xl
            border
            border-slate-100
            bg-slate-50
            p-2.5
            dark:border-slate-800
            dark:bg-slate-950/40
          "
        >

          <p
            className="
              text-[10px]
              font-semibold
              text-slate-400
            "
          >
            Paid
          </p>

          <p
            className="
              mt-1
              text-xs
              font-bold
              text-slate-700
              dark:text-slate-200
            "
          >
            ₹{formatINR(row.paid)}
          </p>

        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-100
            bg-slate-50
            p-2.5
            dark:border-slate-800
            dark:bg-slate-950/40
          "
        >

          <p
            className="
              text-[10px]
              font-semibold
              text-slate-400
            "
          >
            Owes
          </p>

          <p
            className="
              mt-1
              text-xs
              font-bold
              text-slate-700
              dark:text-slate-200
            "
          >
            ₹{formatINR(row.owes)}
          </p>

        </div>

      </div>


      {/* Final expense */}

      <div
        className="
          mt-3
          flex
          items-center
          justify-between
          border-t
          border-slate-100
          pt-3
          dark:border-slate-800
        "
      >

        <span
          className="
            text-[11px]
            font-medium
            text-slate-400
          "
        >
          Final expense
        </span>

        <span
          className="
            text-sm
            font-extrabold
            text-slate-900
            dark:text-white
          "
        >
          ₹{formatINR(
            row.finalExpense
          )}
        </span>

      </div>

    </motion.div>
  );
};


/* ============================================================
   COMPONENT
============================================================ */

export const SpendingTab = ({
  tripId,
}) => {

  const [data, setData] =
    useState([]);

  const [loading, setLoading] =
    useState(true);


  /* ==========================================================
     LOAD SPENDING
  ========================================================== */

  useEffect(() => {

    const loadSpending =
      async () => {

        try {

          setLoading(true);

          const res =
            await settlementsAPI
              .getTripSettlements(
                tripId
              );

          const balances =
            res.data?.balances ||
            {};

          const rows =
            Object.entries(
              balances
            ).map(
              ([
                username,
                b,
              ]) => {

                const paid =
                  Number(
                    b?.paid ?? 0
                  );

                const owes =
                  Number(
                    b?.owes ?? 0
                  );

                const net =
                  Number.isFinite(Number(b?.net))
                    ? Number(b.net)
                    : paid - owes;

                const finalExpense =
                  owes;

                return {
                  username,

                  paid: Number(
                    paid.toFixed(2)
                  ),

                  owes: Number(
                    owes.toFixed(2)
                  ),

                  net: Number(
                    net.toFixed(2)
                  ),

                  action:
                    net >= 0
                      ? 'Received'
                      : 'Paid',

                  actionAmount:
                    Number(
                      Math.abs(
                        net
                      ).toFixed(2)
                    ),

                  finalExpense:
                    Number(
                      finalExpense.toFixed(
                        2
                      )
                    ),
                };
              }
            );

          setData(rows);

        } catch (error) {

          console.error(
            'Failed to load spending data:',
            error
          );

          toast.error(
            'Failed to load spending data'
          );

        } finally {

          setLoading(false);

        }
      };


    loadSpending();

  }, [tripId]);


  /* ==========================================================
     DERIVED VALUES
  ========================================================== */

  const totals = useMemo(() => {

    return data.reduce(
      (acc, row) => {

        acc.paid +=
          Number(
            row.paid || 0
          );

        acc.owes +=
          Number(
            row.owes || 0
          );

        return acc;

      },
      {
        paid: 0,
        owes: 0,
      }
    );

  }, [data]);


  const highestSpender =
    useMemo(() => {

      if (!data.length) {
        return null;
      }

      return [...data].sort(
        (a, b) =>
          b.paid - a.paid
      )[0];

    }, [data]);


  const chartData =
    useMemo(
      () =>
        data.map(
          (row) => ({
            ...row,
            displayName:
              formatUsername(
                row.username
              ),
          })
        ),
      [data]
    );


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {

    return (
      <div className="space-y-5">

        <div
          className="
            h-20
            animate-pulse
            rounded-3xl
            bg-slate-100
            dark:bg-slate-800
          "
        />

        <div
          className="
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-3
          "
        >

          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="
                  h-28
                  animate-pulse
                  rounded-3xl
                  bg-slate-100
                  dark:bg-slate-800
                "
              />
            )
          )}

        </div>

        <div
          className="
            h-[340px]
            animate-pulse
            rounded-3xl
            bg-slate-100
            dark:bg-slate-800
          "
        />

      </div>
    );
  }


  /* ==========================================================
     EMPTY
  ========================================================== */

  if (!data || data.length === 0) {

    return (
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
          from-sky-50
          via-white
          to-indigo-50
          px-6
          text-center
          dark:border-slate-700
          dark:from-sky-950/20
          dark:via-slate-900
          dark:to-indigo-950/20
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
            bg-sky-100
            text-sky-600
            dark:bg-sky-950/50
            dark:text-sky-400
          "
        >
          <FaUsers className="h-7 w-7" />
        </div>

        <h3
          className="
            text-lg
            font-bold
            text-slate-900
            dark:text-white
          "
        >
          No spending data yet
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
          Add expenses to see how much
          each trip member has paid,
          owes, and ultimately spends.
        </p>

      </motion.div>
    );
  }


  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <div className="w-full space-y-5 sm:space-y-6">


      {/* ======================================================
          HEADER
      ====================================================== */}

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
          items-start
          gap-3
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
            bg-gradient-to-br
            from-sky-500
            to-indigo-600
            text-white
            shadow-sm
            sm:h-12
            sm:w-12
          "
        >
          <FaChartBar className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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
            Spending Overview
          </h2>

          <p
            className="
              mt-0.5
              text-xs
              leading-5
              text-slate-500
              dark:text-slate-400
              sm:text-sm
            "
          >
            See what each member paid,
            owes, and ultimately spends.
          </p>

        </div>

      </motion.div>


      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-3
          sm:grid-cols-3
          sm:gap-4
        "
      >

        <SummaryCard
          icon={FaWallet}
          label="Total paid"
          value={`₹${formatINR(
            totals.paid
          )}`}
          description="Money paid by members"
          iconClass="
            bg-sky-50
            text-sky-600
            dark:bg-sky-950/40
            dark:text-sky-400
          "
        />

        <SummaryCard
          icon={FaBalanceScale}
          label="Total shared"
          value={`₹${formatINR(
            totals.owes
          )}`}
          description="Total member shares"
          iconClass="
            bg-indigo-50
            text-indigo-600
            dark:bg-indigo-950/40
            dark:text-indigo-400
          "
          delay={0.05}
        />

        <SummaryCard
          icon={FaUsers}
          label="Members"
          value={data.length}
          description={
            highestSpender
              ? `Top payer: @${formatUsername(
                  highestSpender.username
                )}`
              : 'Trip members'
          }
          iconClass="
            bg-violet-50
            text-violet-600
            dark:bg-violet-950/40
            dark:text-violet-400
          "
          delay={0.1}
        />

      </div>


      {/* ======================================================
          CHART
      ====================================================== */}

      <motion.section
        initial={{
          opacity: 0,
          y: 18,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
        }}
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-[0_12px_35px_-26px_rgba(15,23,42,0.45)]
          dark:border-slate-800
          dark:bg-slate-900
        "
      >

        <div
          className="
            flex
            items-center
            gap-3
            border-b
            border-slate-100
            px-4
            py-4
            dark:border-slate-800
            sm:px-5
            sm:py-5
          "
        >

          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-sky-50
              text-sky-600
              dark:bg-sky-950/40
              dark:text-sky-400
            "
          >
            <FaChartBar className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0">

            <h3
              className="
                text-sm
                font-bold
                text-slate-900
                dark:text-white
                sm:text-base
              "
            >
              Final Expense by Member
            </h3>

            <p
              className="
                mt-0.5
                text-[10px]
                text-slate-400
                sm:text-xs
              "
            >
              Compare each member's final
              share of the trip.
            </p>

          </div>

        </div>


        <div
          className="
            h-[280px]
            w-full
            px-2
            pb-3
            pt-4
            sm:h-[330px]
            sm:px-4
            sm:pb-5
            sm:pt-5
          "
        >

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={chartData}
              margin={{
                top: 10,
                right: 8,
                left: 0,
                bottom:
                  data.length > 4
                    ? 35
                    : 15,
              }}
            >

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(148,163,184,0.20)"
              />

              <XAxis
                dataKey="displayName"
                interval={0}
                tick={{
                  fontSize: 10,
                  fill: '#64748b',
                }}
                angle={
                  data.length > 4
                    ? -35
                    : 0
                }
                textAnchor={
                  data.length > 4
                    ? 'end'
                    : 'middle'
                }
                height={
                  data.length > 4
                    ? 55
                    : 25
                }
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 10,
                  fill: '#64748b',
                }}
                tickFormatter={
                  formatCompactINR
                }
                width={52}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                content={
                  <SpendingTooltip />
                }
                cursor={{
                  fill:
                    'rgba(14,165,233,0.06)',
                }}
              />

              <Bar
                dataKey="finalExpense"
                name="Final Expense"
                fill="#0ea5e9"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
                maxBarSize={54}
                animationDuration={900}
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </motion.section>


      {/* ======================================================
          MOBILE BREAKDOWN
      ====================================================== */}

      <section
        className="
          block
          space-y-3
          md:hidden
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >

          <div>

            <h3
              className="
                text-sm
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              Member Breakdown
            </h3>

            <p
              className="
                mt-0.5
                text-[11px]
                text-slate-400
              "
            >
              Detailed spending summary
            </p>

          </div>

          <span
            className="
              rounded-full
              bg-slate-100
              px-2.5
              py-1
              text-[10px]
              font-semibold
              text-slate-500
              dark:bg-slate-800
              dark:text-slate-400
            "
          >
            {data.length}{' '}
            {data.length === 1
              ? 'member'
              : 'members'}
          </span>

        </div>


        {data.map(
          (row, index) => (
            <MemberMobileCard
              key={row.username}
              row={row}
              index={index}
            />
          )
        )}

      </section>


      {/* ======================================================
          DESKTOP TABLE
      ====================================================== */}

      <section
        className="
          hidden
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-[0_12px_35px_-26px_rgba(15,23,42,0.45)]
          md:block
          dark:border-slate-800
          dark:bg-slate-900
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            gap-4
            border-b
            border-slate-100
            px-5
            py-5
            dark:border-slate-800
          "
        >

          <div>

            <h3
              className="
                text-base
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              Detailed Breakdown
            </h3>

            <p
              className="
                mt-0.5
                text-xs
                text-slate-400
              "
            >
              Paid, owed, net balance,
              and final expense per member.
            </p>

          </div>

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              bg-slate-100
              text-slate-500
              dark:bg-slate-800
              dark:text-slate-400
            "
          >
            <FaUsers className="h-3.5 w-3.5" />
          </div>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[760px]
              text-left
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-100
                  dark:border-slate-800
                "
              >

                <th
                  className="
                    px-5
                    py-3
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Member
                </th>

                <th
                  className="
                    px-4
                    py-3
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Paid
                </th>

                <th
                  className="
                    px-4
                    py-3
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Owes
                </th>

                <th
                  className="
                    px-4
                    py-3
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Net
                </th>

                <th
                  className="
                    px-4
                    py-3
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Status
                </th>

                <th
                  className="
                    px-5
                    py-3
                    text-right
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Final Expense
                </th>

              </tr>

            </thead>


            <tbody
              className="
                divide-y
                divide-slate-100
                dark:divide-slate-800
              "
            >

              {data.map(
                (row) => {

                  const isPositive =
                    row.net >= 0;

                  return (
                    <motion.tr
                      key={row.username}
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: 1,
                      }}
                      className="
                        transition-colors
                        hover:bg-slate-50/70
                        dark:hover:bg-slate-800/40
                      "
                    >

                      {/* MEMBER */}

                      <td className="px-5 py-4">

                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >

                          <MemberAvatar
                            username={
                              row.username
                            }
                          />

                          <div className="min-w-0">

                            <p
                              className="
                                max-w-[180px]
                                truncate
                                text-sm
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              @{row.username}
                            </p>

                            <p
                              className="
                                mt-0.5
                                text-[10px]
                                text-slate-400
                              "
                            >
                              Trip member
                            </p>

                          </div>

                        </div>

                      </td>


                      {/* PAID */}

                      <td
                        className="
                          px-4
                          py-4
                          text-sm
                          font-semibold
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        ₹{formatINR(
                          row.paid
                        )}
                      </td>


                      {/* OWES */}

                      <td
                        className="
                          px-4
                          py-4
                          text-sm
                          font-semibold
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        ₹{formatINR(
                          row.owes
                        )}
                      </td>


                      {/* NET */}

                      <td className="px-4 py-4">

                        <span
                          className={`
                            text-sm
                            font-extrabold
                            ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          `}
                        >
                          {isPositive
                            ? '+'
                            : '-'}
                          ₹
                          {formatINR(
                            Math.abs(
                              row.net
                            )
                          )}
                        </span>

                      </td>


                      {/* STATUS */}

                      <td className="px-4 py-4">

                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-full
                            px-2.5
                            py-1
                            text-[10px]
                            font-bold
                            ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }
                          `}
                        >

                          {isPositive ? (
                            <FaArrowUp className="h-2.5 w-2.5" />
                          ) : (
                            <FaArrowDown className="h-2.5 w-2.5" />
                          )}

                          {row.action}

                          <span>
                            ₹
                            {formatINR(
                              row.actionAmount
                            )}
                          </span>

                        </span>

                      </td>


                      {/* FINAL EXPENSE */}

                      <td
                        className="
                          px-5
                          py-4
                          text-right
                          text-sm
                          font-extrabold
                          text-slate-900
                          dark:text-white
                        "
                      >
                        ₹{formatINR(
                          row.finalExpense
                        )}
                      </td>

                    </motion.tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* ======================================================
          EXPLANATION
      ====================================================== */}

      <div
        className="
          rounded-2xl
          border
          border-sky-100
          bg-sky-50/70
          px-4
          py-3
          dark:border-sky-950
          dark:bg-sky-950/20
        "
      >

        <div
          className="
            flex
            items-start
            gap-3
          "
        >

          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-white
              text-sky-600
              shadow-sm
              dark:bg-slate-900
              dark:text-sky-400
            "
          >
            <FaBalanceScale className="h-3.5 w-3.5" />
          </div>

          <div>

            <p
              className="
                text-xs
                font-semibold
                text-slate-700
                dark:text-slate-200
              "
            >
              How this works
            </p>

            <p
              className="
                mt-0.5
                text-[11px]
                leading-5
                text-slate-500
                dark:text-slate-400
              "
            >
              Final expense represents each
              member's calculated share of the
              trip. Net balance shows whether
              the member should receive money
              or pay money after the expenses
              are split.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
};


export default SpendingTab;

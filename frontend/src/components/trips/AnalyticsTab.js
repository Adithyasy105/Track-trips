// src/components/trips/AnalyticsTab.js

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { motion } from 'framer-motion';

import toast from 'react-hot-toast';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import {
  FaChartLine,
  FaReceipt,
  FaUsers,
  FaCalculator,
  FaChartPie,
  FaMoneyBillWave,
} from 'react-icons/fa';

import { analyticsAPI } from '../../services/api';


/* ============================================================
   CONSTANTS
============================================================ */

const COLORS = [
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];


const formatINR = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return '₹0.00';
  }

  return number.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


const formatCompactINR = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return '₹0';
  }

  if (number >= 10000000) {
    return `₹${(number / 10000000).toFixed(1)}Cr`;
  }

  if (number >= 100000) {
    return `₹${(number / 100000).toFixed(1)}L`;
  }

  if (number >= 1000) {
    return `₹${(number / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(number)}`;
};


const formatTickLabel = (name = '') => {
  if (!name) {
    return '';
  }

  return name.length > 10
    ? `${name.slice(0, 10)}…`
    : name;
};


/* ============================================================
   CUSTOM TOOLTIP
============================================================ */

const CustomBarTooltip = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  const value = payload[0]?.value || 0;

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
          mb-1
          max-w-[180px]
          truncate
          text-xs
          font-semibold
          text-slate-700
          dark:text-slate-200
        "
      >
        {label}
      </p>

      <p
        className="
          text-sm
          font-bold
          text-sky-600
          dark:text-sky-400
        "
      >
        {formatINR(value)}
      </p>
    </div>
  );
};


const CustomPieTooltip = ({
  active,
  payload,
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];

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
          text-xs
          font-semibold
          text-slate-700
          dark:text-slate-200
        "
      >
        {item.name}
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
        {formatINR(item.value)}
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
        group
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

      {/* Decorative glow */}

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
          <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
        </div>

      </div>

    </motion.div>
  );
};


/* ============================================================
   CHART CARD
============================================================ */

const ChartCard = ({
  title,
  subtitle,
  icon: Icon,
  children,
  className = '',
}) => {
  return (
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
        ease: [
          0.22,
          1,
          0.36,
          1,
        ],
      }}
      className={`
        overflow-hidden
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-[0_12px_35px_-26px_rgba(15,23,42,0.45)]
        dark:border-slate-800
        dark:bg-slate-900
        ${className}
      `}
    >

      {/* Header */}

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
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0">

          <h3
            className="
              truncate
              text-sm
              font-bold
              text-slate-900
              dark:text-white
              sm:text-base
            "
          >
            {title}
          </h3>

          {subtitle && (
            <p
              className="
                mt-0.5
                truncate
                text-[10px]
                text-slate-400
                sm:text-xs
              "
            >
              {subtitle}
            </p>
          )}

        </div>

      </div>


      {/* Chart */}

      <div
        className="
          px-2
          pb-3
          pt-4
          sm:px-4
          sm:pb-5
          sm:pt-5
        "
      >
        {children}
      </div>

    </motion.section>
  );
};


/* ============================================================
   COMPONENT
============================================================ */

export const AnalyticsTab = ({
  tripId,
}) => {

  const [analytics, setAnalytics] =
    useState(null);

  const [loading, setLoading] =
    useState(true);


  /* ==========================================================
     LOAD ANALYTICS
  ========================================================== */

  const loadAnalytics =
    useCallback(async () => {
      if (!tripId) {
        return;
      }

      try {
        setLoading(true);

        const response =
          await analyticsAPI.getTripAnalytics(
            tripId
          );

        setAnalytics(
          response?.data || null
        );

      } catch (error) {
        console.error(
          'Failed to load analytics:',
          error
        );

        toast.error(
          'Failed to load analytics'
        );

      } finally {
        setLoading(false);
      }
    }, [tripId]);


  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);


  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const usersData = useMemo(
    () =>
      analytics?.chart_data?.users ||
      [],
    [analytics]
  );

  const categoriesData = useMemo(
    () =>
      analytics?.chart_data?.categories ||
      [],
    [analytics]
  );


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="space-y-5 py-2">

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
            gap-4
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

  if (!analytics) {
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
          <FaChartLine className="h-7 w-7" />
        </div>

        <h3
          className="
            text-lg
            font-bold
            text-slate-900
            dark:text-white
          "
        >
          No analytics yet
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
          Add some trip expenses and your
          spending insights will appear here.
        </p>

      </motion.div>
    );
  }


  /* ==========================================================
     SUMMARY
  ========================================================== */

  const summary =
    analytics.summary || {};


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="w-full space-y-5 sm:space-y-6">


      {/* ======================================================
          PAGE HEADER
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
        transition={{
          duration: 0.35,
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
          <FaChartLine className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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
            Trip Analytics
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
            Understand where your trip money is going.
          </p>

        </div>

      </motion.div>


      {/* ======================================================
          SUMMARY CARDS
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
          icon={FaMoneyBillWave}
          label="Total spent"
          value={formatINR(
            summary.total_expenses
          )}
          description="Across all trip expenses"
          iconClass="
            bg-sky-50
            text-sky-600
            dark:bg-sky-950/40
            dark:text-sky-400
          "
          delay={0}
        />

        <SummaryCard
          icon={FaReceipt}
          label="Expenses"
          value={
            summary.total_expenses_count ??
            0
          }
          description="Transactions recorded"
          iconClass="
            bg-indigo-50
            text-indigo-600
            dark:bg-indigo-950/40
            dark:text-indigo-400
          "
          delay={0.05}
        />

        <SummaryCard
          icon={FaCalculator}
          label="Average expense"
          value={formatINR(
            summary.average_expense
          )}
          description="Average per transaction"
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
          QUICK INSIGHT
      ====================================================== */}

      {usersData.length > 0 && (
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
            duration: 0.35,
            delay: 0.15,
          }}
          className="
            flex
            items-center
            gap-3
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
            <FaUsers className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0">

            <p
              className="
                text-xs
                font-semibold
                text-slate-700
                dark:text-slate-200
              "
            >
              Spending overview
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
              Compare how much each member has
              contributed to the trip.
            </p>

          </div>

        </motion.div>
      )}


      {/* ======================================================
          SPENDING BY USER
      ====================================================== */}

      <ChartCard
        title="Spending by User"
        subtitle="Total amount paid by each member"
        icon={FaUsers}
      >

        {usersData.length > 0 ? (
          <div
            className="
              h-[280px]
              w-full
              sm:h-[330px]
            "
          >

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={usersData}
                margin={{
                  top: 10,
                  right: 8,
                  left: 0,
                  bottom:
                    usersData.length > 4
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
                  dataKey="name"
                  interval={0}
                  tick={{
                    fontSize: 10,
                    fill: '#64748b',
                  }}
                  tickFormatter={
                    formatTickLabel
                  }
                  angle={
                    usersData.length > 4
                      ? -35
                      : 0
                  }
                  textAnchor={
                    usersData.length > 4
                      ? 'end'
                      : 'middle'
                  }
                  height={
                    usersData.length > 4
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
                    <CustomBarTooltip />
                  }
                  cursor={{
                    fill: 'rgba(14,165,233,0.06)',
                  }}
                />

                <Bar
                  dataKey="value"
                  name="Spent"
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
        ) : (
          <div
            className="
              flex
              h-[280px]
              items-center
              justify-center
              text-sm
              text-slate-400
            "
          >
            No user spending data available.
          </div>
        )}

      </ChartCard>


      {/* ======================================================
          CATEGORY + USER AREA

          Desktop: 2 columns
          Mobile: stacked
      ====================================================== */}

      {categoriesData.length > 0 && (
        <ChartCard
          title="Spending by Category"
          subtitle="Where the trip budget is going"
          icon={FaChartPie}
        >

          <div
            className="
              grid
              grid-cols-1
              gap-5
              lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]
              lg:items-center
            "
          >

            {/* PIE */}

            <div
              className="
                h-[270px]
                min-w-0
                sm:h-[320px]
              "
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <PieChart>

                  <Pie
                    data={categoriesData}
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="75%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    animationDuration={900}
                  >

                    {categoriesData.map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            COLORS[
                              index %
                                COLORS.length
                            ]
                          }
                        />
                      )
                    )}

                  </Pie>

                  <Tooltip
                    content={
                      <CustomPieTooltip />
                    }
                  />

                </PieChart>

              </ResponsiveContainer>

            </div>


            {/* CATEGORY LEGEND */}

            <div
              className="
                max-h-[240px]
                overflow-y-auto
                rounded-2xl
                border
                border-slate-100
                bg-slate-50/60
                p-3
                dark:border-slate-800
                dark:bg-slate-950/40
              "
            >

              <div className="space-y-2">

                {categoriesData.map(
                  (category, index) => {

                    const total =
                      categoriesData.reduce(
                        (sum, item) =>
                          sum +
                          Number(
                            item?.value ||
                              0
                          ),
                        0
                      );

                    const value =
                      Number(
                        category?.value ||
                          0
                      );

                    const percentage =
                      total > 0
                        ? (
                            (value /
                              total) *
                            100
                          ).toFixed(1)
                        : '0.0';

                    return (
                      <div
                        key={`category-${index}`}
                        className="
                          flex
                          items-center
                          gap-2.5
                          rounded-xl
                          px-2
                          py-2
                          transition-colors
                          hover:bg-white
                          dark:hover:bg-slate-800
                        "
                      >

                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              COLORS[
                                index %
                                  COLORS.length
                              ],
                          }}
                        />

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >

                          <p
                            className="
                              truncate
                              text-xs
                              font-semibold
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            {category.name}
                          </p>

                          <div
                            className="
                              mt-1
                              h-1
                              overflow-hidden
                              rounded-full
                              bg-slate-200
                              dark:bg-slate-700
                            "
                          >

                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor:
                                  COLORS[
                                    index %
                                      COLORS.length
                                  ],
                              }}
                            />

                          </div>

                        </div>

                        <div
                          className="
                            shrink-0
                            text-right
                          "
                        >

                          <p
                            className="
                              text-xs
                              font-bold
                              text-slate-800
                              dark:text-slate-100
                            "
                          >
                            {formatINR(
                              value
                            )}
                          </p>

                          <p
                            className="
                              text-[9px]
                              text-slate-400
                            "
                          >
                            {percentage}%
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </div>

          </div>

        </ChartCard>
      )}


      {/* ======================================================
          NO CATEGORY DATA
      ====================================================== */}

      {categoriesData.length === 0 && (
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
            rounded-3xl
            border
            border-slate-200
            bg-white
            p-6
            text-center
            dark:border-slate-800
            dark:bg-slate-900
          "
        >

          <div
            className="
              mx-auto
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-2xl
              bg-slate-100
              text-slate-400
              dark:bg-slate-800
            "
          >
            <FaChartPie className="h-4 w-4" />
          </div>

          <p
            className="
              mt-3
              text-sm
              font-semibold
              text-slate-700
              dark:text-slate-200
            "
          >
            No category breakdown
          </p>

          <p
            className="
              mt-1
              text-xs
              text-slate-400
            "
          >
            Category data will appear when
            expenses are categorized.
          </p>

        </motion.div>
      )}

    </div>
  );
};


export default AnalyticsTab;
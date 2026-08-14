// src/pages/Landing.js
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaUsers,
  FaMoneyBillWave,
  FaChartLine,
  FaBolt,
  FaShieldAlt,
  FaArrowRight,
  FaCheckCircle,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { PWAInstallButton } from '../components/PWAInstallPrompt';

export const Landing = () => {
  const features = [
    {
      icon: <HiSparkles className="text-2xl text-primary-500" />,
      title: 'AI Financial Copilot',
      description:
        'Ask questions in plain language like "Where did we spend most?" and get instant contextual insights powered by Gemini AI.',
      tag: 'Gemini AI',
    },
    {
      icon: <FaBolt className="text-2xl text-amber-500" />,
      title: 'Real-Time Synchronization',
      description:
        'Socket.io WebSockets push balance updates, new expenses, and settlement changes to all trip members live.',
      tag: 'WebSockets',
    },
    {
      icon: <FaMoneyBillWave className="text-2xl text-emerald-500" />,
      title: 'Integer Paise Math Engine',
      description:
        'Zero rounding errors. Uses integer paise precision with greedy debt-minimization algorithms for accurate splits.',
      tag: 'Precision Engine',
    },
    {
      icon: <FaUsers className="text-2xl text-sky-500" />,
      title: 'Smart Groups & Trip Hubs',
      description:
        'Create groups, invite friends via secure links, manage multiple trip itineraries, and split bills effortlessly.',
      tag: 'Group Hub',
    },
    {
      icon: <FaChartLine className="text-2xl text-indigo-500" />,
      title: 'Visual Spending Analytics',
      description:
        'Interactive breakdown by category, member balances, and high-performance Redis cached reports.',
      tag: 'Analytics',
    },
    {
      icon: <FaShieldAlt className="text-2xl text-teal-500" />,
      title: 'Transactional Outbox & Security',
      description:
        'Built with Transactional Outbox patterns, optional Kafka event streams, and JWT parameterization.',
      tag: 'High Reliability',
    },
  ];

  const benefits = [
    'Zero financial rounding drift (Paise Math)',
    'Instant real-time Socket.io sync',
    'Gemini AI smart expense categories',
    'Interactive AI Financial Copilot chat',
    '100% free & open for group travel',
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col selection:bg-primary-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-primary-600 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
        <HiSparkles className="h-4 w-4" />
        <span>New: AI Financial Copilot &amp; Real-time WebSocket synchronization live!</span>
      </div>

      {/* Header Nav */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
              <FaUsers className="text-white text-lg" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              TripSync
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PWAInstallButton />
            <Link
              to="/login"
              className="text-slate-300 hover:text-white text-sm font-semibold transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-primary-600/20 transition transform hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow pt-16 pb-16 text-center px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="max-w-4xl mx-auto relative z-10"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-semibold mb-6">
            <HiSparkles className="text-primary-400" />
            Powered by Gemini AI &amp; Socket.io WebSockets
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6"
          >
            Split Trip Expenses. <br />
            <span className="bg-gradient-to-r from-primary-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              Zero Rounding Drift.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Manage group travel, track shared expenses in real time with integer paise math, and ask our AI Financial Copilot anything about your trip.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto"
          >
            <Link
              to="/register"
              className="bg-primary-600 hover:bg-primary-700 text-white px-7 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-600/30 transition flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              Get Started Free <FaArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/login"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-7 py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center"
            >
              Sign In
            </Link>
          </motion.div>

          {/* Benefits List */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-2.5 mt-10 text-slate-300 text-xs font-medium"
          >
            {benefits.map((b, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60"
              >
                <FaCheckCircle className="text-emerald-400" /> {b}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </main>

      {/* Feature Grid */}
      <section className="py-16 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-400 mb-2 block">
              Architected for Travel Groups
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">
              Everything You Need for Group Finances
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Built with integer paise accuracy, real-time push events, and Gemini AI insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-primary-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1.5">
                    {f.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 border-t border-slate-800 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">
            Ready to split trip expenses cleanly?
          </h2>
          <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto">
            Create an account in seconds and experience real-time group balances and AI financial insights.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-7 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary-600/30 transition transform hover:-translate-y-0.5"
          >
            Get Started Free <FaArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-6 text-center text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} TripSync. Built for smart group travel and shared spending.</p>
          <div className="flex gap-3 text-slate-400 text-[11px]">
            <span>Paise Math</span>
            <span>·</span>
            <span>Gemini AI</span>
            <span>·</span>
            <span>Socket.io</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

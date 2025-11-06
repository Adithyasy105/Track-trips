// src/pages/Landing.js
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaUsers,
  FaMoneyBillWave,
  FaChartLine,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaMobileAlt,
  FaArrowRight,
  FaCheckCircle,
} from "react-icons/fa";

export const Landing = () => {
  const features = [
    {
      icon: <FaUsers className="text-3xl text-primary-600" />,
      title: "Smart Group Management",
      description:
        "Create groups, invite friends, and manage multiple trips or events easily.",
    },
    {
      icon: <FaMoneyBillWave className="text-3xl text-primary-600" />,
      title: "Automatic Expense Splitting",
      description:
        "No calculators needed — we split bills, track who owes who, and keep balances updated in real-time.",
    },
    {
      icon: <FaChartLine className="text-3xl text-primary-600" />,
      title: "Visual Insights & Analytics",
      description:
        "Understand spending patterns with beautiful, interactive charts and summaries.",
    },
    {
      icon: <FaMapMarkerAlt className="text-3xl text-primary-600" />,
      title: "Travel Memories & Places",
      description:
        "Document your journey with photos, visited places, and shared trip notes.",
    },
    {
      icon: <FaShieldAlt className="text-3xl text-primary-600" />,
      title: "Private & Secure",
      description:
        "Your data stays yours — encrypted, safe, and password-protected where needed.",
    },
    {
      icon: <FaMobileAlt className="text-3xl text-primary-600" />,
      title: "Optimized for All Devices",
      description:
        "Built mobile-first for smooth experience across phones, tablets, and desktops.",
    },
  ];

  const benefits = [
    "No awkward money conversations again",
    "Instant group balance updates",
    "Auto settlement calculations",
    "Beautiful, intuitive interface",
    "Free forever — no hidden costs",
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FaUsers className="text-primary-600 text-2xl" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              SplitWiser
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              to="/login"
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 font-medium"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow pt-28 sm:pt-32 pb-20 text-center px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: { staggerChildren: 0.2 },
            },
          }}
          className="max-w-4xl mx-auto"
        >
          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6"
          >
            Split <span className="text-primary-600">Smarter</span>, Travel{" "}
            <span className="text-indigo-500">Together</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8"
          >
            The easiest way to split group expenses, manage shared trips, and
            track your spending — all in one place.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link
              to="/register"
              className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold shadow-lg transition flex items-center justify-center gap-2"
            >
              Get Started Free <FaArrowRight />
            </Link>
            <Link
              to="/login"
              className="border border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 px-8 py-4 rounded-lg font-semibold transition"
            >
              Sign In
            </Link>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-12"
          >
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-center text-gray-700 dark:text-gray-300 text-sm"
              >
                <FaCheckCircle className="text-primary-500 mr-2" /> {b}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </main>

      {/* Feature Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Powerful Features for Every Group
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to manage group trips, events, and shared
              finances — beautifully designed and easy to use.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="p-6 rounded-xl shadow-sm hover:shadow-xl transition bg-gray-50 dark:bg-gray-800"
              >
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">
            Ready to simplify your expenses?
          </h2>
          <p className="text-lg mb-8 text-primary-100">
            Join thousands of users who travel, spend, and split smartly every
            day.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/register"
              className="bg-white text-primary-700 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              Create Free Account <FaArrowRight />
            </Link>
            <Link
              to="/login"
              className="border border-white hover:bg-white hover:text-primary-700 px-8 py-3 rounded-lg font-semibold transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-10 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm">
            © {new Date().getFullYear()} SplitWiser. Built with ❤️ for smarter
            group travel and shared spending.
          </p>
        </div>
      </footer>
    </div>
  );
};

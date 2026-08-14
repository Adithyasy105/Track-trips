// src/components/Layout.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FaMoon, FaSun, FaSignOutAlt, FaHome, FaUsers } from 'react-icons/fa';
import { PWAInstallButton } from './PWAInstallPrompt';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Glossy Top Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/60 dark:border-gray-800/60 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-md shadow-primary-600/30 group-hover:scale-105 transition-transform duration-200">
                <FaUsers className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                TripSync
              </span>
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <>
                  <Link
                    to="/dashboard"
                    title="Dashboard"
                    className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <FaHome className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">
                    @{user.username}
                  </span>
                </>
              )}

              <PWAInstallButton />

              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
              >
                {darkMode ? <FaSun className="h-4.5 w-4.5 text-amber-400" /> : <FaMoon className="h-4.5 w-4.5" />}
              </button>

              {user && (
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-200 cursor-pointer"
                >
                  <FaSignOutAlt className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full pb-24 sm:pb-12">
        {children}
      </main>
    </div>
  );
};

export default Layout;

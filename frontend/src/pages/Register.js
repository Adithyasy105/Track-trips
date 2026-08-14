// src/pages/Register.js
import React, { useState, useEffect, useMemo } from 'react';
import { FaUsers, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { PWAInstallButton } from '../components/PWAInstallPrompt';

export const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Password strength logic
  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return { score: 0, label: '', color: 'bg-gray-200 dark:bg-gray-700', text: '' };

    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p) || /[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p) && p.length >= 10) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-500' };
    if (score === 2) return { score: 2, label: 'Medium', color: 'bg-amber-500', text: 'text-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
  }, [formData.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(formData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const nickname = localStorage.getItem('pendingInviteNickname');
    if (nickname) {
      setFormData((prev) => ({ ...prev, full_name: nickname }));
      localStorage.removeItem('pendingInviteNickname');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card max-w-md w-full shadow-xl border border-gray-200/80 dark:border-gray-700/80 relative"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FaArrowLeft className="h-3 w-3" /> Back to Home
          </Link>
          <PWAInstallButton showLabel className="shrink-0" title="Install TripSync app" />
        </div>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <FaUsers className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Your Account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start splitting trip expenses seamlessly</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Username *</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input-field"
              placeholder="e.g. alex"
            />
          </div>

          <div>
            <label className="form-label">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field"
              placeholder="alex@example.com"
            />
          </div>

          <div>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="input-field"
              placeholder="Alex Johnson"
            />
          </div>

          <div>
            <label className="form-label">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-field pr-10"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Password Strength Bar */}
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Password Strength:</span>
                  <span className={`font-semibold ${passwordStrength.text}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 transition-colors duration-300 ${passwordStrength.score >= 1 ? passwordStrength.color : ''}`} />
                  <div className={`h-full flex-1 transition-colors duration-300 ${passwordStrength.score >= 2 ? passwordStrength.color : ''}`} />
                  <div className={`h-full flex-1 transition-colors duration-300 ${passwordStrength.score >= 3 ? passwordStrength.color : ''}`} />
                </div>
              </div>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Must contain 8+ chars, with numbers &amp; letters.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 py-3 cursor-pointer"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;

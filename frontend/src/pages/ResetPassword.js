// src/pages/ResetPassword.js
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaKey, FaEnvelope, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import { authAPI } from '../services/api';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [step, setStep] = useState(tokenFromUrl ? 2 : 1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim() });
      toast.success('If the account exists, a 6-digit OTP has been sent.');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (tokenFromUrl) {
        await authAPI.resetPassword({ token: tokenFromUrl, new_password: password });
      } else {
        if (!otp || otp.length !== 6) {
          toast.error('Please enter a valid 6-digit OTP.');
          setLoading(false);
          return;
        }
        await authAPI.resetPassword({ email: email.trim(), otp: otp.trim(), new_password: password });
      }
      toast.success('Password updated successfully! Please sign in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card max-w-md w-full shadow-xl border border-gray-200/80 dark:border-gray-700/80 relative"
      >
        {/* Back to Home Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4 transition-colors"
        >
          <FaArrowLeft className="h-3 w-3" /> Back to Home
        </Link>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center mx-auto mb-3 shadow-sm">
            {step === 1 ? <FaEnvelope className="h-6 w-6" /> : <FaKey className="h-6 w-6" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {step === 1 ? 'Forgot Password?' : 'Reset Password'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === 1
              ? 'Enter your registered email to receive a 6-digit OTP code.'
              : tokenFromUrl
              ? 'Enter your new password below.'
              : `Enter the 6-digit OTP sent to ${email}`}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 cursor-pointer"
            >
              {loading ? 'Sending Code...' : 'Send 6-Digit OTP'}
            </button>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Remembered your password?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold">
                  Back to Login
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {!tokenFromUrl && (
              <div>
                <label className="form-label">6-Digit OTP Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input-field text-center text-2xl tracking-widest font-mono font-bold"
                  placeholder="123456"
                />
              </div>
            )}

            <div>
              <label className="form-label">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="At least 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Confirm new password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 cursor-pointer"
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>

            <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-100 dark:border-gray-700/60">
              {!tokenFromUrl && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium cursor-pointer"
                >
                  ← Resend / Change Email
                </button>
              )}
              <Link to="/login" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold ml-auto">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;

// src/controllers/userController.js
import crypto from 'crypto';
import { supabase } from '../services/supabaseClient.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateToken, getJwtSecret } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { sendMail } from '../services/mailer.js';
import { redis, isRedisReady } from '../services/redisClient.js';

// ─── OTP constants ────────────────────────────────────────────────────────────
const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || getJwtSecret();
const RESET_SECRET = getJwtSecret();

// Fallback in-memory OTP store if Redis is offline
const fallbackOtpStore = new Map();
const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9._-]{1,63}$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hashEmailKey = (email) =>
  crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

const hashOtpCode = (otp) =>
  crypto.createHmac('sha256', OTP_HMAC_SECRET).update(otp.trim()).digest('hex');

// ─── Register ─────────────────────────────────────────────────────────────────
export const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, full_name } = req.body;

    const { data: existingUser } = await supabase
      .from('users').select('username').eq('username', username).maybeSingle();
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    const { data: existingEmail } = await supabase
      .from('users').select('email').eq('email', email).maybeSingle();
    if (existingEmail) return res.status(400).json({ error: 'Email already registered.' });

    const password_hash = await hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, email, password_hash, full_name }])
      .select('username, email, full_name, created_at');
    if (error) throw error;

    const token = generateToken({ username, email });
    res.status(201).json({ message: 'User registered successfully', user: data[0], token });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('username, email, password_hash, full_name, upi_id')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ username: user.username, email: user.email });
    res.json({
      message: 'Login successful',
      user: { username: user.username, email: user.email, full_name: user.full_name, upi_id: user.upi_id },
      token,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get all users ───────────────────────────────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users').select('username, email, full_name, created_at');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ─── Get current user ─────────────────────────────────────────────────────────
export const getCurrentUser = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, email, full_name, upi_id, created_at')
      .eq('username', req.user.username)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password (OTP-based) ──────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmailKey(normalizedEmail);

    const { data: user, error: dbError } = await supabase
      .from('users').select('username, email').eq('email', normalizedEmail).maybeSingle();
    if (dbError) throw dbError;

    // Always return generic response to prevent user enumeration
    if (!user) {
      console.log(`[forgotPassword] Email not found — returning generic response`);
      return res.json({ message: 'If the email exists, a 6-digit OTP has been sent.' });
    }

    // Generate secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashOtpCode(otpCode);
    const otpKey = `otp:${emailHash}`;

    if (isRedisReady()) {
      await redis.hset(otpKey, 'hash', otpHash, 'attempts', 0);
      await redis.expire(otpKey, 300); // 5 min TTL
    } else {
      fallbackOtpStore.set(emailHash, {
        hash: otpHash,
        attempts: 0,
        expiresAt: Date.now() + 300 * 1000,
      });
    }

    console.log(`[forgotPassword] 🔑 OTP generated for @${user.username} (valid 5 min)`);

    // Send OTP email (non-blocking — failure won't crash the request)
    try {
      await sendMail({
        to: user.email,
        subject: 'TripSync Password Reset OTP',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>TripSync Password Reset</h2>
            <p>Hello @${user.username},</p>
            <p>Your one-time password (OTP) to reset your account is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 20px 0;">
              ${otpCode}
            </div>
            <p>This code is valid for <strong>5 minutes</strong>. Maximum 3 attempts allowed.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`[forgotPassword] ✅ OTP email sent to ${user.email}`);
    } catch (emailErr) {
      console.error('[forgotPassword] ❌ Failed to send OTP email:', emailErr.message);
      // Still return success — email failure is non-fatal
    }

    res.json({ message: 'If the email exists, a 6-digit OTP has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, token, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // ── Legacy token-based reset (backward compatibility) ──
    if (token && !otp) {
      let payload;
      try {
        payload = jwt.verify(token, RESET_SECRET);
      } catch {
        return res.status(400).json({ error: 'Invalid or expired reset token.' });
      }
      if (payload?.type !== 'reset' || !payload?.username) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      const password_hash = await hashPassword(new_password);
      const { error } = await supabase
        .from('users').update({ password_hash }).eq('username', payload.username);
      if (error) throw error;
      return res.json({ message: 'Password updated successfully' });
    }

    // ── OTP-based reset ──
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email, OTP, and new_password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmailKey(normalizedEmail);
    const otpKey = `otp:${emailHash}`;

    let storedData = null;
    if (isRedisReady()) {
      const data = await redis.hgetall(otpKey);
      if (data && data.hash) {
        storedData = { hash: data.hash, attempts: parseInt(data.attempts || '0', 10) };
      }
    } else {
      const record = fallbackOtpStore.get(emailHash);
      if (record && Date.now() < record.expiresAt) storedData = record;
    }

    if (!storedData) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    // Brute-force protection
    if (storedData.attempts >= 3) {
      if (isRedisReady()) await redis.del(otpKey);
      else fallbackOtpStore.delete(emailHash);
      return res.status(403).json({ error: 'Too many invalid attempts. Please request a new OTP.' });
    }

    // Increment attempt counter
    if (isRedisReady()) await redis.hincrby(otpKey, 'attempts', 1);
    else storedData.attempts += 1;

    // Constant-time comparison via HMAC
    const submittedHash = hashOtpCode(otp);
    if (submittedHash !== storedData.hash) {
      const remaining = 2 - storedData.attempts;
      return res.status(400).json({
        error: remaining > 0
          ? `Invalid OTP. ${remaining} attempt(s) remaining.`
          : 'Invalid OTP. OTP invalidated — please request a new one.',
      });
    }

    // Delete OTP — one-time use
    if (isRedisReady()) await redis.del(otpKey);
    else fallbackOtpStore.delete(emailHash);

    const password_hash = await hashPassword(new_password);
    const { error: updateError } = await supabase
      .from('users').update({ password_hash }).eq('email', normalizedEmail);
    if (updateError) throw updateError;

    console.log(`[resetPassword] ✅ Password updated for ${normalizedEmail}`);
    res.json({ message: 'Password updated successfully! Please sign in.' });
  } catch (err) {
    next(err);
  }
};

export const updateUpiId = async (req, res, next) => {
  try {
    const upi_id = typeof req.body?.upi_id === 'string' ? req.body.upi_id.trim() : '';
    if (upi_id && !UPI_ID_PATTERN.test(upi_id)) return res.status(400).json({ error: 'Enter a valid UPI ID, for example name@bank.' });
    const { data, error } = await supabase.from('users').update({ upi_id: upi_id || null })
      .eq('username', req.user.username).select('username, email, full_name, upi_id, created_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) { next(err); }
};

// src/services/mailer.js
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
const FROM_NAME = process.env.FROM_NAME || 'TripSync';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = (process.env.SMTP_SECURE || 'false') === 'true';
const FROM_EMAIL_ENV = process.env.FROM_EMAIL;
const FROM_EMAIL = FROM_EMAIL_ENV || SMTP_USER;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || FROM_EMAIL_ENV || 'no-reply@tripsync.app';

let transporter = null;
let resendClient = null;

if (EMAIL_PROVIDER === 'resend') {
  if (!RESEND_API_KEY) {
    console.error('[mailer] ❌ RESEND_API_KEY is not set. Emails will fail.');
  } else {
    resendClient = new Resend(RESEND_API_KEY);
    console.log('[mailer] ✉️ Using Resend API for transactional email');
    console.log('  RESEND_FROM_EMAIL:', RESEND_FROM_EMAIL);
  }
} else {
  // Check for mismatch (Gmail requires FROM_EMAIL to match SMTP_USER)
  if (FROM_EMAIL_ENV && FROM_EMAIL_ENV !== SMTP_USER && SMTP_HOST.includes('gmail.com')) {
    console.warn('[mailer] ⚠️  WARNING: FROM_EMAIL does not match SMTP_USER!');
    console.warn('  SMTP_USER:', SMTP_USER);
    console.warn('  FROM_EMAIL:', FROM_EMAIL_ENV);
    console.warn('  Gmail will reject emails if FROM_EMAIL differs from SMTP_USER.');
    console.warn('  Using SMTP_USER as FROM_EMAIL to avoid rejection.');
  }

  console.log('[mailer] SMTP Configuration:');
  console.log('  SMTP_HOST:', SMTP_HOST);
  console.log('  SMTP_PORT:', SMTP_PORT);
  console.log('  SMTP_USER:', SMTP_USER || '(NOT SET)');
  console.log('  SMTP_PASS:', SMTP_PASS ? '***SET***' : '(NOT SET)');
  console.log('  SMTP_SECURE:', SMTP_SECURE);
  console.log('  FROM_EMAIL:', FROM_EMAIL || '(NOT SET)');
  if (SMTP_HOST.includes('gmail.com')) {
    console.log('  ⚠️  Using SMTP_USER as FROM_EMAIL (Gmail requirement)');
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.error('[mailer] ❌ ERROR: SMTP credentials are not set! Password reset emails will fail.');
    console.error('  Please set SMTP_USER and SMTP_PASS in your .env file or Render environment variables.');
  } else {
    if (SMTP_HOST.includes('gmail.com')) {
      console.log('[mailer] ℹ️ Gmail SMTP note: use a Gmail address plus a 16-character app password, not the normal account password.');
      console.log('  If this is running on Render, set the values in Render → Environment → Variables and redeploy.');
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      debug: true,
      logger: true,
    });

    transporter.verify((error) => {
      if (error) {
        console.error('[mailer] ❌ SMTP connection verification failed:');
        console.error('  Error:', error.message);
        console.error('  Code:', error.code);
        console.error('  Command:', error.command);
        if (error.response) {
          console.error('  Server Response:', error.response);
        }
      } else {
        console.log('[mailer] ✅ SMTP connection verified successfully');
      }
    });
  }
}

export { transporter };

export const sendMail = async ({ to, subject, html }) => {
  console.log('[mailer] 📧 Attempting to send email...');
  console.log('  Provider:', EMAIL_PROVIDER);
  console.log('  To:', to);
  console.log('  Subject:', subject);

  if (EMAIL_PROVIDER === 'resend') {
    if (!resendClient) {
      throw new Error('Resend client not configured. Check RESEND_API_KEY.');
    }
    const fromAddress = `${FROM_NAME} <${RESEND_FROM_EMAIL}>`;
    console.log('  From:', fromAddress);
    console.log('[mailer] Sending via Resend API...');
    try {
      const result = await resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });
      console.log('[mailer] ✅ Resend API send succeeded', result?.id ? `ID: ${result.id}` : '');
      return result;
    } catch (error) {
      console.error('[mailer] ❌ Resend API send failed:', error);
      throw error;
    }
  }

  if (!transporter) {
    throw new Error('SMTP transporter not configured. Check SMTP credentials.');
  }

  const actualFromEmail =
    SMTP_HOST.includes('gmail.com') && FROM_EMAIL !== SMTP_USER ? SMTP_USER : FROM_EMAIL;
  const fromAddress = `${FROM_NAME} <${actualFromEmail}>`;
  console.log('  From:', fromAddress);
  if (SMTP_HOST.includes('gmail.com') && actualFromEmail !== FROM_EMAIL) {
    console.log('  ⚠️  Using SMTP_USER as FROM_EMAIL (Gmail requirement)');
  }

  try {
    const mailOptions = { from: fromAddress, to, subject, html };
    console.log('[mailer] Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: mailOptions.html?.length || 0,
    });
    const info = await transporter.sendMail(mailOptions);
    console.log('[mailer] ✅ Email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    return info;
  } catch (error) {
    console.error('[mailer] ❌ Failed to send email:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    console.error('  Command:', error.command);
    if (SMTP_HOST.includes('gmail.com') && (error.code === 'EAUTH' || String(error.message).toLowerCase().includes('auth'))) {
      console.error('[mailer] 🔐 Gmail SMTP auth failed. Common cause: the Gmail account password was used instead of a 16-character App Password, or the Render env vars are not loaded.');
      console.error('  Fix: set SMTP_USER to the Gmail address and SMTP_PASS to the Gmail App Password, then redeploy the app.');
    }
    if (error.response) {
      console.error('  Server Response:', error.response);
    }
    if (error.responseCode) {
      console.error('  Response Code:', error.responseCode);
    }
    throw error;
  }
};



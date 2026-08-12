// src/middleware/auth.js
import jwt from 'jsonwebtoken';

export const getJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET?.trim() || process.env.JWT_secret?.trim();

  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a secure value in production.');
  }

  return 'development-only-jwt-secret-change-me';
};

const JWT_SECRET = getJwtSecret();

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // { username, email }
    next();
  });
};

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

// backend/src/middleware/requestId.js
import crypto from 'crypto';

/**
 * Express middleware to attach a unique request ID to req and res headers.
 * Uses native Node.js crypto.randomUUID() for zero external dependency requirement.
 */
export const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId || (crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

export default requestIdMiddleware;

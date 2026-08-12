// src/middleware/errorHandler.js
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

export const errorHandler = (err, req, res, next) => {
  const errorId = err.errorId || `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  metrics.inc('api_error_total');

  logger.error(err.message || 'Unhandled server error', {
    errorId,
    requestId: req.id,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    status: err.status || 500,
  });

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      errorId,
      details: process.env.NODE_ENV === 'development'
        ? err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        : undefined,
    });
  }

  if (err.status) {
    return res.status(err.status).json({ error: process.env.NODE_ENV === 'development' ? err.message : 'Request failed', errorId });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? 'Internal server error' : 'Something went wrong',
    errorId,
    ...(process.env.NODE_ENV === 'development' && { message: err.message, stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  res.status(404).json({ error: 'Route not found', errorId, requestId: req.id });
};

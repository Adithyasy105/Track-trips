// backend/src/utils/logger.js
import dotenv from 'dotenv';

dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const shouldLog = (level) => {
  return LEVELS[level] <= LEVELS[LOG_LEVEL];
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const requestId = meta.requestId ? `[req:${meta.requestId}] ` : '';
  const errorId = meta.errorId ? `[err:${meta.errorId}] ` : '';

  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId: meta.requestId || undefined,
      errorId: meta.errorId || undefined,
      ...meta,
    });
  }

  const prefix = `[${timestamp}] [${level.toUpperCase()}] ${requestId}${errorId}`;
  return typeof message === 'object' 
    ? `${prefix} ${JSON.stringify(message, null, 2)}` 
    : `${prefix} ${message}`;
};

export const logger = {
  info: (message, meta = {}) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },
  warn: (message, meta = {}) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error: (message, meta = {}) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
  debug: (message, meta = {}) => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

export default logger;

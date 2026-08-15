import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import placeRoutes from './routes/placeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import paymentsRoutes from './routes/paymentsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { initSocket } from './services/socketService.js';
import { startOutboxWorker } from './workers/outboxWorker.js';
import { isRedisReady, getRedisHealth } from './services/redisClient.js';
import { getKafkaHealth, isKafkaEnabled } from './services/kafkaProducer.js';
import { supabase } from './services/supabaseClient.js';
import { logger } from './utils/logger.js';
import { metrics } from './utils/metrics.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io real-time engine
initSocket(server);

// Dynamic CORS configuration driven by environment variables
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'https://track-trips.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://f7cnk26r-3000.inc1.devtunnels.ms',
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, mobile apps, server-to-server) or matched origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin '${origin}' not allowed by policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

app.use(cors(corsOptions));
app.use(requestIdMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Liveness probe (HTTP 200 ping for container orchestrator)
app.get('/', (req, res) => res.send('✅ TripSync backend running'));
app.get('/health/live', (req, res) => res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() }));

// Readiness probe & metrics endpoint
app.get('/health/ready', async (req, res) => {
  let dbReady = false;
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    dbReady = !error;
  } catch (err) {
    dbReady = false;
  }

  const redisReady = isRedisReady();
  const redisHealth = getRedisHealth();
  const kafkaHealth = getKafkaHealth();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const isHealthy = dbReady && redisHealth.status !== 'down';

  const statusObj = {
    status: isHealthy ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    service: 'TripSync Backend',
    checks: {
      database: dbReady ? 'HEALTHY' : 'UNHEALTHY',
      redis: redisReady ? 'CONNECTED' : redisHealth.status === 'fallback' ? 'FALLBACK_MODE' : 'UNHEALTHY',
      kafka: kafkaHealth.status === 'ready' ? 'CONNECTED' : kafkaHealth.status === 'disabled' ? 'DISABLED' : 'DEGRADED',
      gemini_ai: geminiConfigured ? 'CONFIGURED' : 'UNCONFIGURED',
    },
    metrics: metrics.getMetrics(),
  };

  res.status(isHealthy ? 200 : 503).json(statusObj);
});

app.get('/metrics', (req, res) => {
  res.status(200).json(metrics.getMetrics());
});

// Backward-compatible /health route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TripSync Backend',
  });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use by another process. Kill the process running on port ${PORT} or restart nodemon.`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  if (isKafkaEnabled()) {
    // Start the transactional outbox only when a Kafka cluster is explicitly configured.
    startOutboxWorker(5000);
  } else {
    logger.info('[Kafka] Disabled. Outbox worker is not running.');
  }
});

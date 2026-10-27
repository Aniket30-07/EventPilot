import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import teamInviteRoutes from './routes/teamInviteRoutes.js';
import { getMyRegistrations } from './controllers/registrationController.js';
import { authenticate, authorizeRoles } from './middleware/auth.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const parseAllowedOrigins = () => {
  const envVal = process.env.FRONTEND_URL || '';
  return envVal
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const clean = origin.trim().replace(/\/+$/, '');
  const allowed = parseAllowedOrigins();
  if (allowed.includes(clean)) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean)) {
    return true;
  }
  // Allow Vercel preview and production deployments
  try {
    const parsed = new URL(clean);
    if (parsed.hostname.endsWith('.vercel.app')) return true;
  } catch {
    // ignore URL parse errors
  }
  return false;
};

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      isAllowedOrigin(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'EventPilot API',
    status: 'running',
    frontend: 'http://localhost:5173',
    health: '/api/health',
    events: '/api/events',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = dbStateMap[mongoose.connection.readyState] || 'unknown';
  const ready = mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'error',
    database: dbState,
  });
});

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.get('Origin')) return next();
  if (isAllowedOrigin(req.get('Origin'))) return next();
  return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api', teamInviteRoutes);
app.get('/api/me/registrations', authenticate, authorizeRoles('participant'), getMyRegistrations);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  console.error('[Server Error]', err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  res.status(status).json({ success: false, message: status === 500 ? 'Internal server error.' : err.message });
});

export default app;

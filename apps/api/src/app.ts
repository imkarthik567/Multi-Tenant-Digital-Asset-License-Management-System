// ==============================================================================
// AssetVault Express Application Setup & Security Hardening
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// Enforces Helmet, CORS allow-list, HPP, Compression, Rate Limiting & Redacted Logging
// ==============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import hpp from 'hpp';
import passport from 'passport';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { configurePassport } from './config/passport';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './errors/errorHandler';
import { NotFoundError } from './errors/AppError';
import apiRoutes from './routes';
import { getHealth } from './controllers/health.controller';

const app = express();

// 1. Initialize Passport Strategies
configurePassport();
app.use(passport.initialize());

// 2. Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 3. Strict CORS Allow-List from CLIENT_URL
const allowedOrigins = [env.CLIENT_URL, env.CORS_ORIGIN].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server or curl/tests where origin is undefined
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: Origin ${origin} not allowed by policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  })
);

// 4. HTTP Parameter Pollution Defense
app.use(hpp());

// 5. Response Compression
app.use(compression());

// 6. Request Body Size Limiting (Prevents payload-based DoS)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// 7. Structured Pino HTTP Logging with Redaction (Never logs passwords/tokens/authorization)
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/health',
      },
    })
  );
}

// 8. Global API Rate Limiting
app.use('/api', globalRateLimiter);

// 9. Health Check Endpoints
app.get('/health', getHealth);
app.get('/api/health', getHealth);

// 10. Mount Primary API Router
app.use('/api', apiRoutes);

// 11. 404 Route Fallthrough
app.use((req, _res, next) => {
  next(new NotFoundError(`Endpoint "${req.method} ${req.path}" does not exist`));
});

// 12. Centralized Error Handler (No stack traces in production)
app.use(errorHandler);

export default app;

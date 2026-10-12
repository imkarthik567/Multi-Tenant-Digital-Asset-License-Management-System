// ==============================================================================
// AssetVault Express Application Setup
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './errors/errorHandler';
import { NotFoundError } from './errors/AppError';
import apiRoutes from './routes';
import { getHealth } from './controllers/health.controller';

const app = express();

// Security and HTTP Header Hardening
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Request Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Global Rate Limiting
app.use('/api', globalRateLimiter);

// Direct Health Check Endpoints
app.get('/health', getHealth);
app.get('/api/health', getHealth);

// Mount API Routes
app.use('/api', apiRoutes);

// 404 Route Fallthrough
app.use((req, _res, next) => {
  next(new NotFoundError(`Endpoint "${req.method} ${req.path}" does not exist`));
});

// Centralized Error Handling
app.use(errorHandler);

export default app;

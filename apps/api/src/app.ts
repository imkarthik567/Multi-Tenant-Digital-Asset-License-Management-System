import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import passport from 'passport';
import { env } from './config/env';
import { configurePassport } from './config/passport';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './errors/errorHandler';
import { NotFoundError } from './errors/AppError';

// Import Route Handlers
import { authRoutes } from './modules/auth/auth.routes';
import { tenantRoutes } from './modules/tenants/tenant.routes';
import { userRoutes } from './modules/users/user.routes';
import { assetRoutes } from './modules/assets/asset.routes';
import { licenseRoutes } from './modules/licenses/license.routes';
import { allocationRoutes } from './modules/allocations/allocation.routes';
import { vendorRoutes } from './modules/vendors/vendor.routes';
import { categoryRoutes } from './modules/categories/category.routes';
import { tagRoutes } from './modules/tags/tag.routes';
import { reportRoutes } from './modules/reports/report.routes';
import { auditRoutes } from './modules/audit-logs/audit.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';

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

// Authentication Strategies
configurePassport();
app.use(passport.initialize());

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'assetvault-api',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// API v1 Routing
const apiV1Router = express.Router();
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/tenants', tenantRoutes);
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/assets', assetRoutes);
apiV1Router.use('/licenses', licenseRoutes);
apiV1Router.use('/allocations', allocationRoutes);
apiV1Router.use('/vendors', vendorRoutes);
apiV1Router.use('/categories', categoryRoutes);
apiV1Router.use('/tags', tagRoutes);
apiV1Router.use('/reports', reportRoutes);
apiV1Router.use('/audit-logs', auditRoutes);
apiV1Router.use('/notifications', notificationRoutes);

app.use('/api/v1', apiV1Router);

// 404 Route Fallthrough
app.use((req, _res, next) => {
  next(new NotFoundError(`Endpoint "${req.method} ${req.path}" does not exist`));
});

// Centralized Error Handling
app.use(errorHandler);

export default app;

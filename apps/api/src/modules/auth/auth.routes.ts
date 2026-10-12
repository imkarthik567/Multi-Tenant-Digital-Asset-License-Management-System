import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.schema';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware';
import { env } from '../../config/env';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  authController.login
);

router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  authController.refresh
);

router.post(
  '/logout',
  authController.logout
);

router.get(
  '/me',
  authenticate,
  tenantScope,
  authController.getMe
);

// Google OAuth 2.0 (Passport.js)
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.CORS_ORIGIN}/login?error=oauth_failed`,
  }),
  (req, res) => {
    // If successful, generate token redirect
    const user = req.user;
    if (user) {
      // In production/local redirect with transient token or session
      res.redirect(`${env.CORS_ORIGIN}/oauth-success?token=session_ready`);
    } else {
      res.redirect(`${env.CORS_ORIGIN}/login?error=unauthorized`);
    }
  }
);

export const authRoutes = router;

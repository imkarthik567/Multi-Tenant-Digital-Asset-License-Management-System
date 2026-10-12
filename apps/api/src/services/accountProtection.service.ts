// ==============================================================================
// AssetVault: Account Protection & Brute-Force Defense Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces 5 failed logins in 15 minutes lockout per target email address
// ==============================================================================

import { TooManyRequestsError } from '../errors/AppError';
import { logger } from '../config/logger';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// In-memory sliding window cache for failed authentication attempts
const failedAttemptsMap = new Map<string, AttemptRecord>();

// Periodic garbage collection every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of failedAttemptsMap.entries()) {
    if (now - record.firstAttemptAt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      failedAttemptsMap.delete(email);
    }
  }
}, 10 * 60 * 1000).unref();

export const checkEmailLockout = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = failedAttemptsMap.get(normalizedEmail);

  if (!record) return;

  const now = Date.now();

  // If currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    logger.warn({ email: normalizedEmail }, 'Blocked login attempt on temporarily locked account');
    throw new TooManyRequestsError(
      `Too many failed login attempts for this email. Account locked for ${remainingMinutes} more minute(s).`
    );
  }

  // Check if active 15m window has exceeded maximum attempts
  if (now - record.firstAttemptAt <= WINDOW_MS && record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = record.firstAttemptAt + WINDOW_MS;
    logger.warn({ email: normalizedEmail }, 'Account locked due to 5 consecutive failed login attempts');
    throw new TooManyRequestsError(
      'Too many failed login attempts for this email address. Please try again in 15 minutes.'
    );
  }
};

export const recordFailedLogin = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const record = failedAttemptsMap.get(normalizedEmail);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    failedAttemptsMap.set(normalizedEmail, {
      count: 1,
      firstAttemptAt: now,
    });
  } else {
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + WINDOW_MS;
      logger.warn({ email: normalizedEmail }, 'Max failed logins reached. Email locked.');
    }
  }
};

export const resetFailedLogins = (email: string): void => {
  failedAttemptsMap.delete(email.toLowerCase().trim());
};

// ==============================================================================
// AssetVault: Automated Email-Only Member Profile & Credential Derivation Utility
// Course: BCSE307L Database Systems (Fall 2026-27)
// Automatically derives display names, strong initial passwords, and parses bulk
// email lists when admins provide only member email addresses.
// ==============================================================================

import crypto from 'crypto';

/**
 * Derives a human-readable full name from an email address.
 * Examples:
 * - "rahul.sharma@organization.com" -> "Rahul Sharma"
 * - "karthiksmrk7377@gmail.com" -> "Karthiksmrk"
 * - "elena_rostova_24@acme.io" -> "Elena Rostova"
 */
export function deriveNameFromEmail(email: string): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  const localPart = cleanEmail.split('@')[0] || 'member';

  // Split by common separators (., _, -, +)
  const rawTokens = localPart
    .split(/[._\-+]+/)
    .map((token) => token.replace(/\d+$/g, '').trim())
    .filter((token) => token.length > 0);

  if (rawTokens.length === 0) {
    // Fallback if local part was purely numeric or symbols
    const fallback = localPart.replace(/[^a-zA-Z0-9]/g, '');
    return fallback.length >= 2
      ? `Member ${fallback.slice(0, 8).toUpperCase()}`
      : 'Organization Member';
  }

  const formatted = rawTokens
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (formatted.length < 2) {
    return `${formatted.toUpperCase()} Member`;
  }

  return formatted.slice(0, 100);
}

/**
 * Generates a strong initial password automatically for zero-touch member onboarding.
 */
export function generateAutoPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';

  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  const chars = [
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
    pick(upper),
    pick(lower),
    pick(digits),
    pick(lower),
    pick(upper),
    pick(digits),
  ];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return `Av!${chars.join('')}`;
}

/**
 * Extracts and deduplicates valid email addresses from raw text, CSV content,
 * or newline/comma/semicolon separated strings.
 */
export function extractEmailsFromText(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join('\n') : String(input || '');
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = raw.match(emailRegex) || [];

  const seen = new Set<string>();
  const validEmails: string[] = [];

  for (const match of matches) {
    const normalized = match.trim().toLowerCase();
    // Ignore obvious CSV header placeholders like email@example.com if other real emails exist
    if (!seen.has(normalized)) {
      seen.add(normalized);
      validEmails.push(normalized);
    }
  }

  return validEmails;
}

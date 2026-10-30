// ==============================================================================
// AssetVault: Automated Organization Email Notification Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Automatically dispatches transactional emails to organization members (seat holders)
// and administrators (Tenant Admins & Asset Managers) on license expirations,
// seat allocations/revocations, and contract updates/renewals.
// ==============================================================================

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { mockStore } from '../config/mockStore';
import { notificationStreamService } from './notificationStream.service';

interface PersistedRelayConfig {
  oauthAccessToken?: string | null;
  oauthSenderEmail?: string | null;
  smtpEmail?: string | null;
  smtpAppPassword?: string | null;
  updatedAt?: string;
}

export type AutomatedEmailEventType =
  | 'MEMBER_ONBOARDED'
  | 'EXPIRY_30'
  | 'EXPIRY_15'
  | 'EXPIRY_7'
  | 'EXPIRED'
  | 'SEAT_ALLOCATED'
  | 'SEAT_REVOKED'
  | 'LICENSE_RENEWED'
  | 'LICENSE_UPDATED';

export interface ExpiryEmailPayload {
  to: string;
  recipientName: string;
  recipientRole?: string;
  recipientUserId?: string;
  tenantId?: string;
  tenantName: string;
  licenseId?: string;
  licenseName: string;
  daysLeft: number;
  expiryDate: string;
  type: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED';
}

export interface AutomatedEmailDeliveryRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  recipientUserId?: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: string;
  licenseId?: string;
  licenseName: string;
  eventType: AutomatedEmailEventType;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  status: 'SENT' | 'FAILED';
  deliveryChannel?: 'GMAIL_API' | 'SMTP' | 'SANDBOX';
  realGmailSent?: boolean;
  sentAt: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isInitialized = false;
  // Google OAuth access token for real Gmail API delivery (persisted across restarts)
  private gmailAccessToken: string | null = null;
  private connectedGmailSender: string | null = null;
  // Verified Gmail SMTP (App Password) transporter for 24/7 zero-popup background delivery
  private gmailSmtpTransporter: Transporter | null = null;
  private connectedSmtpSender: string | null = null;

  constructor() {
    this.hydratePersistedRelay();
  }

  private getRelayConfigPaths(): string[] {
    return [
      path.resolve(os.tmpdir(), '.gmail-relay-config.json'),
      path.resolve(process.cwd(), '.gmail-relay-config.json'),
      path.resolve(process.cwd(), 'backend/.gmail-relay-config.json'),
    ];
  }

  private loadPersistedRelay(): PersistedRelayConfig {
    for (const filePath of this.getRelayConfigPaths()) {
      try {
        if (fs.existsSync(filePath)) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      } catch {
        // ignore read error
      }
    }
    return {};
  }

  private savePersistedRelay(patch: Partial<PersistedRelayConfig>): void {
    const existing = this.loadPersistedRelay();
    const merged: PersistedRelayConfig = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(merged, null, 2);
    for (const filePath of this.getRelayConfigPaths()) {
      try {
        if (fs.existsSync(path.dirname(filePath))) {
          fs.writeFileSync(filePath, serialized, 'utf-8');
        }
      } catch {
        // ignore write error
      }
    }
  }

  private hydratePersistedRelay(): void {
    const saved = this.loadPersistedRelay();
    if (saved.oauthAccessToken && this.isRealGoogleAccessToken(saved.oauthAccessToken)) {
      this.gmailAccessToken = saved.oauthAccessToken;
      this.connectedGmailSender = saved.oauthSenderEmail || null;
    }
    if (saved.smtpEmail && saved.smtpAppPassword) {
      this.connectedSmtpSender = saved.smtpEmail;
      (mockStore.state as any).smtpConfig = {
        email: saved.smtpEmail,
        appPassword: saved.smtpAppPassword,
      };
    }
  }

  private isRealGoogleAccessToken(token?: string | null): boolean {
    if (!token || typeof token !== 'string') return false;
    const t = token.trim();
    if (
      t === 'universal-relay' ||
      t === 'universal-relay-verified' ||
      t === 'verified-google-identity' ||
      t === 'smtp-verified'
    ) {
      return false;
    }
    return t.startsWith('ya29.') || t.length > 35;
  }

  private getEffectiveGmailAccessToken(tenantId?: string | null): string | null {
    // 1. Check tenant-specific OAuth access token first
    const tenantCfg = tenantId ? (mockStore.state as any)?.tenantSenders?.[tenantId] : null;
    if (tenantCfg?.oauthAccessToken && this.isRealGoogleAccessToken(tenantCfg.oauthAccessToken)) {
      return tenantCfg.oauthAccessToken;
    }
    // 2. Check active in-memory OAuth token
    if (this.gmailAccessToken && this.isRealGoogleAccessToken(this.gmailAccessToken)) {
      return this.gmailAccessToken;
    }
    // 3. Check persisted relay file
    const saved = this.loadPersistedRelay();
    if (saved.oauthAccessToken && this.isRealGoogleAccessToken(saved.oauthAccessToken)) {
      this.gmailAccessToken = saved.oauthAccessToken;
      this.connectedGmailSender = saved.oauthSenderEmail || this.connectedGmailSender || null;
      return this.gmailAccessToken;
    }
    // 4. Check mockStore state relay
    const stateRelay = (mockStore.state as any)?.gmailRelay;
    if (stateRelay?.accessToken && this.isRealGoogleAccessToken(stateRelay.accessToken)) {
      this.gmailAccessToken = stateRelay.accessToken;
      this.connectedGmailSender = stateRelay.senderEmail || this.connectedGmailSender || null;
      return this.gmailAccessToken;
    }
    return null;
  }

  public setGmailAccessToken(
    token: string | null,
    senderEmail?: string | null,
    tenantId?: string | null,
    senderName?: string | null
  ): void {
    const cleanEmail =
      senderEmail && senderEmail.trim().includes('@')
        ? senderEmail.trim().toLowerCase()
        : null;
    const hasRealToken = Boolean(token && this.isRealGoogleAccessToken(token));
    const cleanToken = hasRealToken && token ? token.trim() : null;

    if (cleanToken) {
      const relayEmail = cleanEmail || this.connectedGmailSender || null;
      this.gmailAccessToken = cleanToken;
      if (relayEmail) {
        this.connectedGmailSender = relayEmail;
      }
      (mockStore.state as any).gmailRelay = {
        accessToken: cleanToken,
        senderEmail: relayEmail,
        updatedAt: new Date().toISOString(),
      };
      this.savePersistedRelay({
        oauthAccessToken: cleanToken,
        oauthSenderEmail: relayEmail,
      });
      mockStore.saveState();
    }

    if (cleanEmail && tenantId) {
      if (!(mockStore.state as any).tenantSenders) {
        (mockStore.state as any).tenantSenders = {};
      }
      const prev = (mockStore.state as any).tenantSenders[tenantId] || {};
      (mockStore.state as any).tenantSenders[tenantId] = {
        ...prev,
        email: cleanEmail,
        fullName:
          (senderName && senderName.trim()) ||
          prev.fullName ||
          (cleanEmail.split('@')[0] || 'Organization Admin')
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        ...(cleanToken ? { oauthAccessToken: cleanToken } : {}),
        updatedAt: new Date().toISOString(),
      };
      mockStore.saveState();
    }
  }

  public getTenantSender(
    tenantId?: string | null,
    fallbackEmail?: string | null,
    fallbackName?: string | null
  ): { email: string; fullName: string } {
    const tenantSenders = (mockStore.state as any)?.tenantSenders || {};
    if (tenantId && tenantSenders[tenantId]?.email) {
      return {
        email: tenantSenders[tenantId].email,
        fullName: tenantSenders[tenantId].fullName || 'Organization Admin',
      };
    }

    if (fallbackEmail && fallbackEmail.trim().includes('@')) {
      const clean = fallbackEmail.trim().toLowerCase();
      return {
        email: clean,
        fullName:
          (fallbackName && fallbackName.trim()) ||
          (clean.split('@')[0] || 'Organization Admin')
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    }

    if (tenantId && Array.isArray(mockStore.state.users)) {
      const tenantAdmin = mockStore.state.users.find(
        (u) => u.tenantId === tenantId && u.roleId === 2 && u.email
      );
      if (tenantAdmin) {
        return {
          email: tenantAdmin.email.toLowerCase(),
          fullName: tenantAdmin.fullName || 'Organization Admin',
        };
      }
    }

    const storedSmtp = this.getStoredSmtpConfig(tenantId);
    const fallback =
      this.connectedGmailSender ||
      this.connectedSmtpSender ||
      storedSmtp?.email ||
      env.SMTP_USER ||
      env.SMTP_FROM ||
      'admin@organization.io';

    return {
      email: fallback,
      fullName: 'Organization Admin',
    };
  }

  public disconnectAllGmailSenders(tenantId?: string | null): void {
    if (tenantId && (mockStore.state as any).tenantSenders?.[tenantId]) {
      delete (mockStore.state as any).tenantSenders[tenantId];
    }
    mockStore.saveState();
  }

  private getStoredSmtpConfig(
    tenantId?: string | null
  ): { email: string; appPassword: string } | null {
    // 1. Check tenant-specific SMTP credentials first
    const tenantCfg = tenantId ? (mockStore.state as any)?.tenantSenders?.[tenantId] : null;
    if (
      tenantCfg?.email &&
      typeof tenantCfg?.smtpAppPassword === 'string' &&
      tenantCfg.smtpAppPassword.length >= 8
    ) {
      return {
        email: tenantCfg.email,
        appPassword: tenantCfg.smtpAppPassword,
      };
    }
    // 2. Check global/persisted SMTP configuration
    const cfg = (mockStore.state as any)?.smtpConfig;
    if (cfg && typeof cfg.email === 'string' && typeof cfg.appPassword === 'string' && cfg.appPassword.length >= 8) {
      return cfg;
    }
    const saved = this.loadPersistedRelay();
    if (saved.smtpEmail && saved.smtpAppPassword && saved.smtpAppPassword.length >= 8) {
      const restored = { email: saved.smtpEmail, appPassword: saved.smtpAppPassword };
      (mockStore.state as any).smtpConfig = restored;
      return restored;
    }
    if (env.SMTP_USER && env.SMTP_PASS) {
      return { email: env.SMTP_USER, appPassword: env.SMTP_PASS };
    }
    return null;
  }

  public async configureGmailSmtp(params: {
    email: string;
    appPassword: string;
    tenantId?: string | null;
  }): Promise<{ verified: boolean; senderEmail: string }> {
    const cleanEmail = (params.email || '').trim().toLowerCase();
    const cleanPassword = (params.appPassword || '').replace(/\s+/g, '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please provide a valid Gmail address.');
    }
    if (!cleanPassword || cleanPassword.length < 8) {
      throw new Error('Please enter a valid 16-character Google App Password.');
    }

    // Try port 465 SSL first, then port 587 STARTTLS
    let verifiedTransporter: Transporter | null = null;
    let lastError: any = null;

    for (const portConfig of [
      { port: 465, secure: true },
      { port: 587, secure: false },
    ]) {
      try {
        const candidate = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: portConfig.port,
          secure: portConfig.secure,
          auth: {
            user: cleanEmail,
            pass: cleanPassword,
          },
        });
        await candidate.verify();
        verifiedTransporter = candidate;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!verifiedTransporter) {
      const rawMsg = lastError?.message || 'Could not authenticate with smtp.gmail.com';
      throw new Error(
        `Gmail SMTP verification failed: ${rawMsg}. Please verify that 2-Step Verification is enabled on ${cleanEmail} and use its 16-character Google App Password.`
      );
    }

    this.gmailSmtpTransporter = verifiedTransporter;
    this.connectedSmtpSender = cleanEmail;
    (mockStore.state as any).smtpConfig = {
      email: cleanEmail,
      appPassword: cleanPassword,
    };
    this.savePersistedRelay({
      smtpEmail: cleanEmail,
      smtpAppPassword: cleanPassword,
    });
    if (params.tenantId) {
      if (!(mockStore.state as any).tenantSenders) {
        (mockStore.state as any).tenantSenders = {};
      }
      const prev = (mockStore.state as any).tenantSenders[params.tenantId] || {};
      (mockStore.state as any).tenantSenders[params.tenantId] = {
        ...prev,
        email: cleanEmail,
        smtpAppPassword: cleanPassword,
        updatedAt: new Date().toISOString(),
      };
    }
    mockStore.saveState();

    logger.info({ senderEmail: cleanEmail, tenantId: params.tenantId }, 'Verified and saved 24/7 Gmail SMTP App Password');
    return {
      verified: true,
      senderEmail: cleanEmail,
    };
  }

  public async sendViaGmailSmtp(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    tenantId?: string | null;
  }): Promise<boolean> {
    const stored = this.getStoredSmtpConfig(params.tenantId);
    if (!this.gmailSmtpTransporter && stored) {
      this.gmailSmtpTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: stored.email,
          pass: stored.appPassword,
        },
      });
      this.connectedSmtpSender = stored.email;
    }

    if (!this.gmailSmtpTransporter) {
      return false;
    }

    try {
      const transportAuthSender = stored?.email || this.connectedSmtpSender || env.SMTP_FROM;
      const tenantSender = this.getTenantSender(params.tenantId);
      await this.gmailSmtpTransporter.sendMail({
        from: `"${tenantSender.fullName} (AssetVault)" <${transportAuthSender}>`,
        replyTo: `"${tenantSender.fullName}" <${tenantSender.email}>`,
        to: params.to.trim(),
        subject: params.subject.trim(),
        text: params.text,
        html: params.html,
      });
      logger.info({ to: params.to, from: tenantSender.email }, 'Delivered real email via Gmail SMTP');
      return true;
    } catch (err) {
      logger.warn({ err, to: params.to }, 'Gmail SMTP send failed');
      return false;
    }
  }

  public getGmailStatus(
    tenantId?: string | null,
    fallbackEmail?: string | null,
    fallbackName?: string | null
  ): {
    connected: boolean;
    realRelayActive: boolean;
    relayAccount: string | null;
    mode: 'GMAIL_API' | 'GMAIL_SMTP' | 'SANDBOX';
    senderEmail: string | null;
    senderName?: string;
    oauthConnected: boolean;
    smtpConfigured: boolean;
    pendingSandboxCount: number;
  } {
    const allLogs = Array.isArray(mockStore.state.emailDeliveries)
      ? mockStore.state.emailDeliveries
      : [];
    const pendingSandboxCount = allLogs.filter(
      (entry) =>
        (!tenantId || entry.tenantId === tenantId) &&
        !entry.realGmailSent
    ).length;

    const tenantSender = this.getTenantSender(tenantId, fallbackEmail, fallbackName);
    const activeToken = this.getEffectiveGmailAccessToken(tenantId);
    const storedSmtp = this.getStoredSmtpConfig(tenantId);
    const oauthConnected = Boolean(activeToken);
    const smtpConfigured = Boolean(storedSmtp);
    const realRelayActive = Boolean(oauthConnected || smtpConfigured);
    const connected = realRelayActive;
    const mode: 'GMAIL_API' | 'GMAIL_SMTP' | 'SANDBOX' = smtpConfigured
      ? 'GMAIL_SMTP'
      : oauthConnected
      ? 'GMAIL_API'
      : 'SANDBOX';
    const relayAccount =
      storedSmtp?.email ||
      this.connectedGmailSender ||
      tenantSender.email ||
      null;

    return {
      connected,
      realRelayActive,
      relayAccount,
      mode,
      senderEmail: tenantSender.email,
      senderName: tenantSender.fullName,
      oauthConnected,
      smtpConfigured,
      pendingSandboxCount,
    };
  }

  private encodeMimeSubject(subject: string): string {
    return `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  }

  private toBase64Url(raw: string): string {
    return Buffer.from(raw, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Dispatches a real email directly through the authenticated Gmail API
   * (https://gmail.googleapis.com/gmail/v1/users/me/messages/send)
   */
  public async sendViaGmailApi(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    tenantId?: string | null;
    accessTokenOverride?: string;
  }): Promise<boolean> {
    const candidateOverride =
      params.accessTokenOverride && this.isRealGoogleAccessToken(params.accessTokenOverride)
        ? params.accessTokenOverride
        : null;
    const token = candidateOverride || this.getEffectiveGmailAccessToken(params.tenantId);
    if (!token) return false;

    try {
      const contentType = params.html
        ? 'text/html; charset="UTF-8"'
        : 'text/plain; charset="UTF-8"';
      const tenantSender = this.getTenantSender(params.tenantId);
      const relayEmail = this.connectedGmailSender || tenantSender.email;
      const safeName = (tenantSender.fullName || 'Organization Admin').replace(/"/g, '');

      const emailLines = [
        `From: "${safeName} (AssetVault)" <${relayEmail}>`,
        `Reply-To: "${safeName}" <${tenantSender.email}>`,
        `To: ${params.to.trim()}`,
        `Content-Type: ${contentType}`,
        'MIME-Version: 1.0',
        `Subject: ${this.encodeMimeSubject(params.subject.trim())}`,
        '',
        params.html || params.text,
      ];

      const rawEmail = emailLines.join('\r\n');
      const encodedEmail = this.toBase64Url(rawEmail);

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedEmail,
          }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        logger.warn({ status: response.status, to: params.to }, 'Gmail OAuth token expired or unauthorized');
        if (!candidateOverride) {
          this.gmailAccessToken = null;
          if (params.tenantId && (mockStore.state as any).tenantSenders?.[params.tenantId]) {
            delete (mockStore.state as any).tenantSenders[params.tenantId].oauthAccessToken;
          }
          if ((mockStore.state as any).gmailRelay) {
            delete (mockStore.state as any).gmailRelay;
          }
          this.savePersistedRelay({ oauthAccessToken: null });
          mockStore.saveState();
        }
        return false;
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        logger.warn({ status: response.status, errBody, to: params.to }, 'Gmail API send failed');
        return false;
      }

      logger.info({ to: params.to, from: tenantSender.email, subject: params.subject }, 'Delivered real email via Google Gmail API');
      return true;
    } catch (err) {
      logger.warn({ err, to: params.to }, 'Error invoking Google Gmail API');
      return false;
    }
  }

  /**
   * Flushes any previously queued sandbox emails in mockStore.state.emailDeliveries
   * to real member Gmail inboxes via connected Google OAuth API or Gmail SMTP.
   */
  public async flushPendingEmailsViaGmail(
    tenantId?: string | null,
    accessTokenOverride?: string
  ): Promise<{ flushedCount: number; recipients: string[] }> {
    const validOverride =
      accessTokenOverride && this.isRealGoogleAccessToken(accessTokenOverride)
        ? accessTokenOverride
        : undefined;
    if (validOverride) {
      const sender = this.getTenantSender(tenantId);
      this.setGmailAccessToken(validOverride, this.connectedGmailSender || sender.email, tenantId);
    }
    const token = validOverride || this.getEffectiveGmailAccessToken(tenantId);

    const hasSmtp = Boolean(this.connectedSmtpSender || this.getStoredSmtpConfig(tenantId));
    if (!token && !hasSmtp) {
      return { flushedCount: 0, recipients: [] };
    }

    const allLogs = Array.isArray(mockStore.state.emailDeliveries)
      ? mockStore.state.emailDeliveries
      : [];

    const pendingLogs = allLogs.filter(
      (entry) =>
        (!tenantId || entry.tenantId === tenantId) &&
        !entry.realGmailSent &&
        Boolean(entry.recipientEmail)
    );

    let flushedCount = 0;
    const recipients = new Set<string>();

    for (const entry of pendingLogs) {
      let sent = false;
      let channel: 'GMAIL_API' | 'SMTP' = 'GMAIL_API';

      if (hasSmtp) {
        sent = await this.sendViaGmailSmtp({
          to: entry.recipientEmail,
          subject: entry.subject,
          text: entry.bodyText,
          html: entry.bodyHtml,
          tenantId: entry.tenantId,
        });
        channel = 'SMTP';
      }

      if (!sent && token) {
        sent = await this.sendViaGmailApi({
          to: entry.recipientEmail,
          subject: entry.subject,
          text: entry.bodyText,
          html: entry.bodyHtml,
          tenantId: entry.tenantId,
          accessTokenOverride: token,
        });
        channel = 'GMAIL_API';
      }

      if (sent) {
        entry.realGmailSent = true;
        entry.deliveryChannel = channel;
        entry.sentAt = new Date().toISOString();
        flushedCount++;
        recipients.add(entry.recipientEmail);
      }
    }

    if (flushedCount > 0) {
      mockStore.saveState();
    }

    return {
      flushedCount,
      recipients: Array.from(recipients),
    };
  }

  /**
   * Sends or re-sends a single logged email entry directly to the recipient's real Gmail inbox.
   */
  public async sendLoggedEmailViaGmail(
    logId: string,
    accessTokenOverride?: string
  ): Promise<AutomatedEmailDeliveryRecord | null> {
    const allLogs = Array.isArray(mockStore.state.emailDeliveries)
      ? mockStore.state.emailDeliveries
      : [];
    const entry = allLogs.find((item) => item.id === logId);
    if (!entry) return null;

    if (accessTokenOverride) {
      this.gmailAccessToken = accessTokenOverride;
    }

    let sent = await this.sendViaGmailApi({
      to: entry.recipientEmail,
      subject: entry.subject,
      text: entry.bodyText,
      html: entry.bodyHtml,
      accessTokenOverride,
    });
    let channel: 'GMAIL_API' | 'SMTP' = 'GMAIL_API';

    if (!sent) {
      sent = await this.sendViaGmailSmtp({
        to: entry.recipientEmail,
        subject: entry.subject,
        text: entry.bodyText,
        html: entry.bodyHtml,
      });
      channel = 'SMTP';
    }

    if (sent) {
      entry.realGmailSent = true;
      entry.deliveryChannel = channel;
      entry.sentAt = new Date().toISOString();
      mockStore.saveState();
    }

    return entry;
  }

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter && this.isInitialized) {
      return this.transporter;
    }

    if (process.env.NODE_ENV === 'test') {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.isInitialized = true;
      return this.transporter;
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'Configured production SMTP transporter');
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info({ user: testAccount.user }, 'Created dynamic Ethereal test account for dev email delivery');
      } catch (err: any) {
        logger.warn({ err }, 'Ethereal test account creation failed; using JSON transport fallback');
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }

    this.isInitialized = true;
    return this.transporter;
  }

  private getRoleNameById(roleId?: number): string {
    switch (roleId) {
      case 1:
        return 'SUPER_ADMIN';
      case 2:
        return 'TENANT_ADMIN';
      case 3:
        return 'ASSET_MANAGER';
      case 4:
      default:
        return 'MEMBER';
    }
  }

  private recordEmailDelivery(record: Omit<AutomatedEmailDeliveryRecord, 'id' | 'sentAt'>): AutomatedEmailDeliveryRecord {
    const entry: AutomatedEmailDeliveryRecord = {
      id: `email-${crypto.randomUUID()}`,
      ...record,
      sentAt: new Date().toISOString(),
    };

    if (!Array.isArray(mockStore.state.emailDeliveries)) {
      mockStore.state.emailDeliveries = [];
    }
    mockStore.state.emailDeliveries.unshift(entry);
    mockStore.saveState();
    return entry;
  }

  /**
   * Generates responsive HTML & plain-text email template for license expiration alerts
   */
  private generateTemplate(payload: ExpiryEmailPayload): { subject: string; html: string; text: string } {
    const { recipientName, recipientRole, tenantName, licenseName, daysLeft, expiryDate, type } = payload;

    let badgeColor = '#3b82f6';
    let badgeText = 'NOTICE (30 DAYS)';
    let urgencyTitle = `License "${licenseName}" Expires in ${daysLeft} Days`;

    if (type === 'EXPIRY_15') {
      badgeColor = '#f59e0b';
      badgeText = 'WARNING (15 DAYS)';
      urgencyTitle = `Action Required: License "${licenseName}" Expires in ${daysLeft} Days`;
    } else if (type === 'EXPIRY_7') {
      badgeColor = '#ef4444';
      badgeText = 'CRITICAL (7 DAYS)';
      urgencyTitle = `Urgent: License "${licenseName}" Expires in ${daysLeft} Days`;
    } else if (type === 'EXPIRED') {
      badgeColor = '#991b1b';
      badgeText = 'EXPIRED';
      urgencyTitle = `ALERT: License "${licenseName}" Has Expired`;
    }

    const roleDescription =
      recipientRole === 'MEMBER'
        ? 'Assigned Seat Holder (MEMBER)'
        : `Organization Administrator (${recipientRole || 'TENANT_ADMIN'})`;

    const subject = `[AssetVault] ${badgeText}: ${licenseName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px 24px;">
      <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">
        AssetVault <span style="font-size: 14px; font-weight: 400; color: #94a3b8;">| Automated Organization Alert</span>
      </h2>
    </div>
    <div style="padding: 24px;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor}; margin-bottom: 16px;">
        ${badgeText}
      </div>
      <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #0f172a;">${urgencyTitle}</h3>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        Hello <strong>${recipientName}</strong>, this is an automated notification sent to your organization email account (<strong>${payload.to}</strong>) for workspace <strong>${tenantName}</strong>.
      </p>

      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Organization:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Recipient Role:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${roleDescription}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Software License:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${licenseName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Contract End Date:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${expiryDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Time Remaining:</td>
            <td style="padding: 6px 0; font-weight: 700; color: ${badgeColor};">${type === 'EXPIRED' ? 'Expired' : `${daysLeft} days`}</td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        ${
          recipientRole === 'MEMBER'
            ? 'Your assigned license seat is approaching its contract end date. Organization administrators have also been notified to renew coverage.'
            : 'Please review covering licenses or trigger a contract renewal in AssetVault to prevent assigned member seats and covered digital assets from lapsing.'
        }
      </p>

      <a href="${env.CLIENT_URL}/licenses" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 6px;">
        View License in AssetVault &rarr;
      </a>
    </div>
    <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
      Automated organization email dispatched by AssetVault.
    </div>
  </div>
</body>
</html>
`;

    const text = `Hello ${recipientName},\n\nThis is an automated alert from your organization workspace ${tenantName}.\n\n[${badgeText}] ${urgencyTitle}\nOrganization: ${tenantName}\nRecipient Role: ${roleDescription}\nLicense: ${licenseName}\nContract End Date: ${expiryDate}\nRemaining: ${
      type === 'EXPIRED' ? 'Expired' : `${daysLeft} days`
    }\n\nPlease visit ${env.CLIENT_URL}/licenses to review or renew this license.`;

    return { subject, html, text };
  }

  /**
   * Dispatches expiry alert email (via real Gmail SMTP or Gmail API when connected, or sandbox fallback) and logs delivery
   */
  public async sendExpiryAlert(payload: ExpiryEmailPayload): Promise<boolean> {
    const { subject, html, text } = this.generateTemplate(payload);
    let deliveryChannel: 'GMAIL_API' | 'SMTP' | 'SANDBOX' = 'SANDBOX';
    let realGmailSent = false;

    const sentViaSmtp = await this.sendViaGmailSmtp({
      to: payload.to,
      subject,
      text,
      html,
      tenantId: payload.tenantId,
    });
    if (sentViaSmtp) {
      deliveryChannel = 'SMTP';
      realGmailSent = true;
    }

    if (!realGmailSent && this.getEffectiveGmailAccessToken(payload.tenantId)) {
      const sentViaGmail = await this.sendViaGmailApi({
        to: payload.to,
        subject,
        text,
        html,
        tenantId: payload.tenantId,
      });
      if (sentViaGmail) {
        deliveryChannel = 'GMAIL_API';
        realGmailSent = true;
      }
    }

    if (!realGmailSent) {
      try {
        const tenantSender = this.getTenantSender(payload.tenantId);
        const transporter = await this.getTransporter();
        const info = await transporter.sendMail({
          from: `"${tenantSender.fullName} (${payload.tenantName || 'AssetVault'})" <${tenantSender.email}>`,
          replyTo: `"${tenantSender.fullName}" <${tenantSender.email}>`,
          to: payload.to,
          subject,
          text,
          html,
        });

        deliveryChannel = 'SANDBOX';
        realGmailSent = false;

        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info(
          {
            to: payload.to,
            from: tenantSender.email,
            messageId: info.messageId,
            license: payload.licenseName,
            previewUrl: previewUrl || undefined,
          },
          'Queued automated license expiry email in sandbox (awaiting global Gmail relay)'
        );
      } catch (err: any) {
        logger.error({ err, to: payload.to, license: payload.licenseName }, 'Failed to deliver expiry notification email');
      }
    }

    this.recordEmailDelivery({
      tenantId: payload.tenantId || 'tenant-acme-corp',
      tenantName: payload.tenantName,
      recipientUserId: payload.recipientUserId,
      recipientEmail: payload.to,
      recipientName: payload.recipientName,
      recipientRole: payload.recipientRole || 'TENANT_ADMIN',
      licenseId: payload.licenseId,
      licenseName: payload.licenseName,
      eventType: payload.type,
      subject,
      bodyText: text,
      bodyHtml: html,
      status: 'SENT',
      deliveryChannel,
      realGmailSent,
    });

    return realGmailSent;
  }

  /**
   * Sends a generic automated organization event email (member onboarding, seat allocation/revocation, license renewal/update)
   */
  private async sendCustomEventEmail(params: {
    tenantId: string;
    tenantName: string;
    recipientUserId?: string;
    recipientEmail: string;
    recipientName: string;
    recipientRole: string;
    licenseId?: string;
    licenseName: string;
    eventType: AutomatedEmailEventType;
    badgeLabel: string;
    badgeColor: string;
    subject: string;
    headline: string;
    bodyText: string;
    detailsRows: Array<{ label: string; value: string }>;
  }): Promise<AutomatedEmailDeliveryRecord> {
    const tenantSender = this.getTenantSender(params.tenantId);
    const rowsHtml = params.detailsRows
      .map(
        (r) => `
          <tr>
            <td style="padding: 6px 0; color: #64748b;">${r.label}:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${r.value}</td>
          </tr>`
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${params.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px 24px;">
      <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">
        AssetVault <span style="font-size: 14px; font-weight: 400; color: #94a3b8;">| ${params.tenantName} (${tenantSender.email})</span>
      </h2>
    </div>
    <div style="padding: 24px;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${params.badgeColor}; margin-bottom: 16px;">
        ${params.badgeLabel}
      </div>
      <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #0f172a;">${params.headline}</h3>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        Hello <strong>${params.recipientName}</strong> (${params.recipientEmail}), this is an automated update from <strong>${tenantSender.fullName}</strong> (${tenantSender.email}) at <strong>${params.tenantName}</strong>.
      </p>
      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${rowsHtml}
        </table>
      </div>
      <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5; white-space: pre-line;">${params.bodyText}</p>
    </div>
  </div>
</body>
</html>`;

    let deliveryChannel: 'GMAIL_API' | 'SMTP' | 'SANDBOX' = 'SANDBOX';
    let realGmailSent = false;

    const sentViaSmtp = await this.sendViaGmailSmtp({
      to: params.recipientEmail,
      subject: params.subject,
      text: params.bodyText,
      html,
      tenantId: params.tenantId,
    });
    if (sentViaSmtp) {
      deliveryChannel = 'SMTP';
      realGmailSent = true;
    }

    if (!realGmailSent && this.getEffectiveGmailAccessToken(params.tenantId)) {
      const sentViaGmail = await this.sendViaGmailApi({
        to: params.recipientEmail,
        subject: params.subject,
        text: params.bodyText,
        html,
        tenantId: params.tenantId,
      });
      if (sentViaGmail) {
        deliveryChannel = 'GMAIL_API';
        realGmailSent = true;
      }
    }

    if (!realGmailSent) {
      try {
        const transporter = await this.getTransporter();
        await transporter.sendMail({
          from: `"${tenantSender.fullName} (${params.tenantName})" <${tenantSender.email}>`,
          replyTo: `"${tenantSender.fullName}" <${tenantSender.email}>`,
          to: params.recipientEmail,
          subject: params.subject,
          text: params.bodyText,
          html,
        });
        deliveryChannel = 'SANDBOX';
        realGmailSent = false;
      } catch (err) {
        logger.warn({ err, to: params.recipientEmail }, 'SMTP transport warning; logged in automated delivery ledger');
      }
    }

    return this.recordEmailDelivery({
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      recipientUserId: params.recipientUserId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      recipientRole: params.recipientRole,
      licenseId: params.licenseId,
      licenseName: params.licenseName,
      eventType: params.eventType,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyHtml: html,
      status: 'SENT',
      deliveryChannel,
      realGmailSent,
    });
  }

  /**
   * Resolves all organization admins and active workspace members for a tenant
   */
  private getLicenseRecipients(tenantId: string, licenseId?: string, extraUserId?: string) {
    const activeSeatHolderIds = new Set<string>();
    if (licenseId) {
      for (const alloc of mockStore.state.allocations) {
        if (alloc.licenseId === licenseId && alloc.status === 'ACTIVE' && alloc.userId) {
          activeSeatHolderIds.add(alloc.userId);
        }
      }
    }
    if (extraUserId) {
      activeSeatHolderIds.add(extraUserId);
    }

    const recipients = mockStore.state.users.filter(
      (u) =>
        u.isActive !== false &&
        Boolean(u.email) &&
        (u.tenantId === tenantId || activeSeatHolderIds.has(u.id))
    );

    const uniqueByEmail = new Map<string, any>();
    for (const user of recipients) {
      const emailKey = user.email.toLowerCase();
      if (!uniqueByEmail.has(emailKey)) {
        uniqueByEmail.set(emailKey, {
          ...user,
          roleName: this.getRoleNameById(user.roleId),
          isSeatHolder: activeSeatHolderIds.has(user.id),
        });
      }
    }
    return Array.from(uniqueByEmail.values());
  }

  /**
   * Dispatches pending expiry notifications for a tenant and sends automated emails to all assigned seat holders + admins
   */
  public async dispatchPendingExpiryEmailsForTenant(
    tenantId: string,
    lookaheadDays: number = 30
  ): Promise<{ emailsSent: number; recipients: string[] }> {
    const tenant = mockStore.state.tenants.find((t) => t.id === tenantId);
    const tenantName = tenant?.name || 'Organization';
    let emailsSent = 0;
    const recipientEmails = new Set<string>();

    // First process any notifications where emailSent === false
    const pendingNotifs = mockStore.state.notifications.filter(
      (n) => n.tenantId === tenantId && n.emailSent === false
    );

    for (const notif of pendingNotifs) {
      const user = mockStore.state.users.find((u) => u.id === notif.userId);
      const lic = mockStore.state.licenses.find((l) => l.id === notif.licenseId);
      const recipientEmail = user?.email || notif.recipientEmail;
      if (!recipientEmail) continue;

      const rawEnd = lic?.endDate || lic?.expiresAt;
      const daysLeft = rawEnd
        ? Math.max(0, Math.ceil((new Date(rawEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      const expiryDate: string = rawEnd ? (new Date(rawEnd).toISOString().split('T')[0] || 'N/A') : 'N/A';
      const roleName = this.getRoleNameById(user?.roleId);
      const licenseName = lic?.name || lic?.licenseKey || 'Software License';
      const eventType: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED' =
        ['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED'].includes(notif.type)
          ? notif.type
          : daysLeft <= 0
          ? 'EXPIRED'
          : daysLeft <= 7
          ? 'EXPIRY_7'
          : daysLeft <= 15
          ? 'EXPIRY_15'
          : 'EXPIRY_30';

      await this.sendExpiryAlert({
        to: recipientEmail,
        recipientName: user?.fullName || notif.recipientName || 'Organization Member',
        recipientRole: roleName,
        recipientUserId: user?.id,
        tenantId,
        tenantName,
        licenseId: lic?.id,
        licenseName,
        daysLeft,
        expiryDate,
        type: eventType,
      });

      notif.emailSent = true;
      notif.recipientEmail = recipientEmail;
      notif.message =
        eventType === 'EXPIRED'
          ? `Automated email sent to ${recipientEmail}: License "${licenseName}" expired on ${expiryDate}.`
          : `Automated email sent to ${recipientEmail}: License "${licenseName}" expires on ${expiryDate} (${daysLeft} days remaining).`;

      emailsSent++;
      recipientEmails.add(recipientEmail);
    }

    // If no pending notifications were queued, still ensure any expiring license within lookaheadDays dispatches fresh automated emails on manual scan
    if (emailsSent === 0) {
      const expiringLicenses = mockStore.state.licenses.filter((l) => {
        if (l.tenantId !== tenantId || l.status === 'CANCELLED' || l.deletedAt) return false;
        const rawEnd = l.endDate || l.expiresAt;
        if (!rawEnd) return false;
        const daysLeft = Math.ceil((new Date(rawEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysLeft <= lookaheadDays;
      });

      for (const lic of expiringLicenses) {
        const rawEnd = lic.endDate || lic.expiresAt;
        const endDateObj = new Date(rawEnd);
        const daysLeft = Math.max(0, Math.ceil((endDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const expiryDate: string = endDateObj.toISOString().split('T')[0] || 'N/A';
        const licenseName = lic.name || lic.licenseKey || 'Software License';
        const eventType: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED' =
          daysLeft <= 0
            ? 'EXPIRED'
            : daysLeft <= 7
            ? 'EXPIRY_7'
            : daysLeft <= 15
            ? 'EXPIRY_15'
            : 'EXPIRY_30';

        const recipients = this.getLicenseRecipients(tenantId, lic.id);
        for (const rec of recipients) {
          await this.sendExpiryAlert({
            to: rec.email,
            recipientName: rec.fullName,
            recipientRole: rec.roleName,
            recipientUserId: rec.id,
            tenantId,
            tenantName,
            licenseId: lic.id,
            licenseName,
            daysLeft,
            expiryDate,
            type: eventType,
          });
          emailsSent++;
          recipientEmails.add(rec.email);
        }
      }
    }

    mockStore.saveState();
    return {
      emailsSent,
      recipients: Array.from(recipientEmails),
    };
  }

  /**
   * Automatically dispatches emails when a seat is allocated to an organization member
   */
  public async dispatchSeatAllocationEmails(params: {
    tenantId: string;
    licenseId: string;
    targetUserId: string;
    allocationId: string;
    notes?: string;
  }): Promise<void> {
    const tenant = mockStore.state.tenants.find((t) => t.id === params.tenantId);
    const tenantName = tenant?.name || 'Organization';
    const lic = mockStore.state.licenses.find((l) => l.id === params.licenseId);
    const vendor = mockStore.state.vendors.find((v) => v.id === lic?.vendorId);
    const targetUser = mockStore.state.users.find((u) => u.id === params.targetUserId);

    const licenseName = lic?.name || lic?.licenseKey || 'Enterprise Software License';
    const vendorName = vendor?.name || 'Enterprise Vendor';
    const rawEnd = lic?.endDate || lic?.expiresAt;
    const expiryDate: string = rawEnd ? (new Date(rawEnd).toISOString().split('T')[0] || 'Perpetual') : 'Perpetual';

    const recipients = this.getLicenseRecipients(params.tenantId, params.licenseId, params.targetUserId).filter(
      (r) => r.id === params.targetUserId || r.roleId === 2 || r.roleId === 3
    );

    for (const rec of recipients) {
      const isAllocatedMember = rec.id === params.targetUserId;
      const subject = isAllocatedMember
        ? `[AssetVault] License Seat Allocated to You: ${licenseName}`
        : `[AssetVault] Seat Allocated to ${targetUser?.fullName || 'Member'}: ${licenseName}`;

      const headline = isAllocatedMember
        ? `Your Seat for "${licenseName}" is Active`
        : `Seat Allocated: ${targetUser?.fullName || 'Member'} (${targetUser?.email || ''})`;

      const bodyText = isAllocatedMember
        ? `Hello ${rec.fullName},\n\nAn active software license seat for "${licenseName}" (${vendorName}) has been allocated to your organization account (${rec.email}) in ${tenantName}.\n\nContract End Date: ${expiryDate}\nAllocation ID: ${params.allocationId}`
        : `Hello ${rec.fullName},\n\nA software license seat for "${licenseName}" (${vendorName}) was allocated to organization member ${targetUser?.fullName || 'Member'} (${targetUser?.email || 'N/A'}).\n\nContract End Date: ${expiryDate}\nRemaining Seats: ${Math.max(0, Number(lic?.totalSeats || 1) - Number(lic?.allocatedSeats || 0))} / ${lic?.totalSeats || 1}`;

      await this.sendCustomEventEmail({
        tenantId: params.tenantId,
        tenantName,
        recipientUserId: rec.id,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        recipientRole: rec.roleName,
        licenseId: params.licenseId,
        licenseName,
        eventType: 'SEAT_ALLOCATED',
        badgeLabel: 'SEAT ALLOCATED',
        badgeColor: '#10b981',
        subject,
        headline,
        bodyText,
        detailsRows: [
          { label: 'Organization', value: tenantName },
          { label: 'Assigned Member', value: `${targetUser?.fullName || 'Member'} (${targetUser?.email || ''})` },
          { label: 'Software License', value: `${licenseName} (${vendorName})` },
          { label: 'Contract End Date', value: expiryDate },
        ],
      });

      const notif = {
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        userId: rec.id,
        licenseId: params.licenseId,
        type: 'SYSTEM',
        title: headline,
        message: `Automated email sent to ${rec.email}: Seat allocated for "${licenseName}" (End Date: ${expiryDate}).`,
        isRead: false,
        emailSent: true,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        createdAt: new Date(),
      };
      mockStore.state.notifications.unshift(notif);
      notificationStreamService.broadcastNotification({
        tenantId: params.tenantId,
        userId: rec.id,
        notification: notif,
      });
    }
    mockStore.saveState();
  }

  /**
   * Automatically dispatches emails when a seat is released/revoked from an organization member
   */
  public async dispatchSeatRevocationEmails(params: {
    tenantId: string;
    licenseId: string;
    targetUserId: string;
    allocationId: string;
    reason: string;
  }): Promise<void> {
    const tenant = mockStore.state.tenants.find((t) => t.id === params.tenantId);
    const tenantName = tenant?.name || 'Organization';
    const lic = mockStore.state.licenses.find((l) => l.id === params.licenseId);
    const targetUser = mockStore.state.users.find((u) => u.id === params.targetUserId);
    const licenseName = lic?.name || lic?.licenseKey || 'Enterprise Software License';

    const recipients = this.getLicenseRecipients(params.tenantId, undefined, params.targetUserId);

    for (const rec of recipients) {
      const isRevokedMember = rec.id === params.targetUserId;
      const subject = isRevokedMember
        ? `[AssetVault] License Seat Released: ${licenseName}`
        : `[AssetVault] Seat Released from ${targetUser?.fullName || 'Member'}: ${licenseName}`;

      const headline = isRevokedMember
        ? `Your Seat for "${licenseName}" Was Released`
        : `Seat Released: ${targetUser?.fullName || 'Member'} (${targetUser?.email || ''})`;

      const bodyText = `Hello ${rec.fullName},\n\nThe software license seat for "${licenseName}" assigned to ${targetUser?.fullName || 'Member'} (${targetUser?.email || ''}) in ${tenantName} has been released back to the organization pool.\n\nReason: ${params.reason}`;

      await this.sendCustomEventEmail({
        tenantId: params.tenantId,
        tenantName,
        recipientUserId: rec.id,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        recipientRole: rec.roleName,
        licenseId: params.licenseId,
        licenseName,
        eventType: 'SEAT_REVOKED',
        badgeLabel: 'SEAT RELEASED',
        badgeColor: '#f59e0b',
        subject,
        headline,
        bodyText,
        detailsRows: [
          { label: 'Organization', value: tenantName },
          { label: 'Affected Member', value: `${targetUser?.fullName || 'Member'} (${targetUser?.email || ''})` },
          { label: 'Software License', value: licenseName },
          { label: 'Release Reason', value: params.reason },
        ],
      });

      const notif = {
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        userId: rec.id,
        licenseId: params.licenseId,
        type: 'SYSTEM',
        title: headline,
        message: `Automated email sent to ${rec.email}: Seat released for "${licenseName}" (${params.reason}).`,
        isRead: false,
        emailSent: true,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        createdAt: new Date(),
      };
      mockStore.state.notifications.unshift(notif);
      notificationStreamService.broadcastNotification({
        tenantId: params.tenantId,
        userId: rec.id,
        notification: notif,
      });
    }
    mockStore.saveState();
  }

  /**
   * Automatically dispatches emails when a license is renewed or updated (end date, capacity, status)
   */
  public async dispatchLicenseUpdateEmails(params: {
    tenantId: string;
    licenseId: string;
    eventType: 'LICENSE_RENEWED' | 'LICENSE_UPDATED';
    newEndDate?: Date | string | null;
    notes?: string;
    summary?: string;
  }): Promise<void> {
    const tenant = mockStore.state.tenants.find((t) => t.id === params.tenantId);
    const tenantName = tenant?.name || 'Organization';
    const lic = mockStore.state.licenses.find((l) => l.id === params.licenseId);
    if (!lic) return;

    const licenseName = lic.name || lic.licenseKey || 'Enterprise Software License';
    const rawEnd = params.newEndDate ?? lic.endDate ?? lic.expiresAt;
    const expiryDate: string = rawEnd ? (new Date(rawEnd).toISOString().split('T')[0] || 'Perpetual') : 'Perpetual';

    const recipients = this.getLicenseRecipients(params.tenantId, params.licenseId);

    for (const rec of recipients) {
      const isRenewal = params.eventType === 'LICENSE_RENEWED';
      const subject = isRenewal
        ? `[AssetVault] License Renewed: ${licenseName} (New End Date: ${expiryDate})`
        : `[AssetVault] License Updated: ${licenseName} (End Date: ${expiryDate})`;

      const headline = isRenewal
        ? `License "${licenseName}" Renewed Through ${expiryDate}`
        : `License "${licenseName}" Contract Updated`;

      const bodyText = isRenewal
        ? `Hello ${rec.fullName},\n\nSoftware license "${licenseName}" in ${tenantName} has been renewed.\n\nUpdated Contract End Date: ${expiryDate}\nTotal Seats: ${lic.totalSeats || 1}\nStatus: ${lic.status || 'ACTIVE'}${params.notes ? `\nNotes: ${params.notes}` : ''}`
        : `Hello ${rec.fullName},\n\nSoftware license "${licenseName}" in ${tenantName} was updated.\n\nContract End Date: ${expiryDate}\nTotal Seats: ${lic.totalSeats || 1}\nStatus: ${lic.status || 'ACTIVE'}${params.summary ? `\nUpdate Summary: ${params.summary}` : ''}`;

      await this.sendCustomEventEmail({
        tenantId: params.tenantId,
        tenantName,
        recipientUserId: rec.id,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        recipientRole: rec.roleName,
        licenseId: params.licenseId,
        licenseName,
        eventType: params.eventType,
        badgeLabel: isRenewal ? 'CONTRACT RENEWED' : 'LICENSE UPDATED',
        badgeColor: '#6366f1',
        subject,
        headline,
        bodyText,
        detailsRows: [
          { label: 'Organization', value: tenantName },
          { label: 'Recipient Role', value: rec.isSeatHolder ? `Assigned Seat Holder (${rec.roleName})` : rec.roleName },
          { label: 'Software License', value: licenseName },
          { label: 'Contract End Date', value: expiryDate },
          { label: 'Total Seats', value: String(lic.totalSeats || 1) },
        ],
      });

      const notif = {
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        userId: rec.id,
        licenseId: params.licenseId,
        type: 'SYSTEM',
        title: headline,
        message: `Automated email sent to ${rec.email}: ${headline}.`,
        isRead: false,
        emailSent: true,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        createdAt: new Date(),
      };
      mockStore.state.notifications.unshift(notif);
      notificationStreamService.broadcastNotification({
        tenantId: params.tenantId,
        userId: rec.id,
        notification: notif,
      });
    }

    // Also if the updated end date is within 30 days (or expired), automatically send an immediate expiry alert email
    if (rawEnd) {
      const daysLeft = Math.ceil((new Date(rawEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        const expType: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED' =
          daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 7 ? 'EXPIRY_7' : daysLeft <= 15 ? 'EXPIRY_15' : 'EXPIRY_30';
        for (const rec of recipients) {
          await this.sendExpiryAlert({
            to: rec.email,
            recipientName: rec.fullName,
            recipientRole: rec.roleName,
            recipientUserId: rec.id,
            tenantId: params.tenantId,
            tenantName,
            licenseId: params.licenseId,
            licenseName,
            daysLeft: Math.max(0, daysLeft),
            expiryDate,
            type: expType,
          });
        }
      }
    }

    mockStore.saveState();
  }

  /**
   * Automatically dispatches a welcome & login credentials email when a member email is stored
   */
  public async dispatchMemberOnboardingEmail(params: {
    tenantId: string;
    userId: string;
    email: string;
    fullName: string;
    roleName: string;
    generatedPassword?: string;
    isEmailUpdate?: boolean;
  }): Promise<void> {
    const tenant = mockStore.state.tenants.find((t) => t.id === params.tenantId);
    const tenantName = tenant?.name || 'Organization Workspace';
    const loginUrl = `${env.CLIENT_URL}/login`;

    const subject = params.isEmailUpdate
      ? `[AssetVault] Your Organization Email Was Updated (${tenantName})`
      : `[AssetVault] Welcome to ${tenantName} — Your Account & Access Details`;

    const headline = params.isEmailUpdate
      ? `Organization Email Active: ${params.email}`
      : `Welcome to ${tenantName} on AssetVault`;

    const bodyText = params.isEmailUpdate
      ? `Hello ${params.fullName},\n\nYour organization email address in ${tenantName} has been updated to ${params.email}. All automated software license seat allocations, contract renewals, and expiration alerts will now be delivered automatically to this address.\n\nWorkspace Login: ${loginUrl}`
      : `Hello ${params.fullName},\n\nYour email address (${params.email}) has been added to the ${tenantName} workspace in AssetVault. Your member profile and login credentials have been provisioned automatically:\n\nWorkspace: ${tenantName}\nLogin Email: ${params.email}\nAuto-Generated Password: ${params.generatedPassword || 'Use your existing organization password'}\nAssigned Role: ${params.roleName}\nSign-In URL: ${loginUrl}\n\nAll software license seat allocations, renewals, and expiration notices for your account will be delivered automatically to this email address.`;

    const detailsRows: Array<{ label: string; value: string }> = [
      { label: 'Organization Workspace', value: tenantName },
      { label: 'Member Email', value: params.email },
      { label: 'Member Name', value: params.fullName },
      { label: 'Assigned Role', value: params.roleName },
    ];

    if (params.generatedPassword && !params.isEmailUpdate) {
      detailsRows.push({ label: 'Auto-Generated Password', value: params.generatedPassword });
    }
    detailsRows.push({ label: 'Workspace Portal', value: loginUrl });

    await this.sendCustomEventEmail({
      tenantId: params.tenantId,
      tenantName,
      recipientUserId: params.userId,
      recipientEmail: params.email,
      recipientName: params.fullName,
      recipientRole: params.roleName,
      licenseName: 'Organization Member Onboarding',
      eventType: 'MEMBER_ONBOARDED',
      badgeLabel: params.isEmailUpdate ? 'EMAIL VERIFIED' : 'AUTO-ONBOARDED',
      badgeColor: '#6366f1',
      subject,
      headline,
      bodyText,
      detailsRows,
    });

    const notif = {
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'SYSTEM',
      title: headline,
      message: params.isEmailUpdate
        ? `Automated confirmation email sent to ${params.email} (${params.fullName}).`
        : `Automated welcome & login credentials email sent to ${params.email} (${params.fullName}).`,
      isRead: false,
      emailSent: true,
      recipientEmail: params.email,
      recipientName: params.fullName,
      createdAt: new Date(),
    };
    mockStore.state.notifications.unshift(notif);
    notificationStreamService.broadcastNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      notification: notif,
    });

    // Also check if any active licenses in this tenant are expiring soon and automatically notify if needed
    mockStore.saveState();
  }

  /**
   * Automatically dispatches an organization role-change notification email when a user's role is updated
   * Dispatches to the target member, the logged-in admin, and all active workspace team members
   */
  public async dispatchRoleChangeEmail(params: {
    tenantId: string;
    userId: string;
    email: string;
    fullName: string;
    previousRole: string;
    newRole: string;
    reason?: string;
    actorEmail?: string;
  }): Promise<{
    emailRecord: AutomatedEmailDeliveryRecord | null;
    recipients: string[];
    realGmailSent: boolean;
    notification: any;
  }> {
    const tenant = mockStore.state.tenants.find((t) => t.id === params.tenantId);
    const tenantName = tenant?.name || 'Organization Workspace';
    const loginUrl = `${env.CLIENT_URL}/login`;
    const tenantSender = this.getTenantSender(params.tenantId, params.actorEmail);

    // Build complete list of workspace recipients:
    // 1. Target member (params.email)
    // 2. Active admin sender (tenantSender.email)
    // 3. All active members in this organization (params.tenantId)
    const recipientMap = new Map<string, { id?: string; email: string; fullName: string; roleName: string }>();

    const addRecipient = (email?: string | null, fullName?: string | null, id?: string, roleName?: string) => {
      if (!email || !email.includes('@')) return;
      const clean = email.trim().toLowerCase();
      if (!recipientMap.has(clean)) {
        recipientMap.set(clean, {
          id,
          email: clean,
          fullName:
            (fullName && fullName.trim()) ||
            (clean.split('@')[0] || 'Member')
              .replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          roleName: roleName || 'MEMBER',
        });
      }
    };

    addRecipient(params.email, params.fullName, params.userId, params.newRole);
    addRecipient(tenantSender.email, tenantSender.fullName, undefined, 'TENANT_ADMIN');
    if (params.actorEmail) {
      addRecipient(params.actorEmail, undefined, undefined, 'TENANT_ADMIN');
    }

    for (const u of mockStore.state.users) {
      if (u.isActive !== false && u.email && u.tenantId === params.tenantId) {
        addRecipient(u.email, u.fullName, u.id, this.getRoleNameById(u.roleId));
      }
    }

    const subject = `[AssetVault] Role Updated in ${tenantName}: ${params.previousRole} → ${params.newRole}`;
    const headline = `Organization Role Updated: ${params.fullName} (${params.previousRole} → ${params.newRole})`;

    let primaryRecord: AutomatedEmailDeliveryRecord | null = null;
    let anyRealSent = false;
    const deliveredTo: string[] = [];

    for (const rec of recipientMap.values()) {
      const isTargetUser = rec.email === params.email.trim().toLowerCase();
      const bodyText = isTargetUser
        ? `Hello ${rec.fullName},\n\nYour organization role in ${tenantName} has been updated from ${params.previousRole} to ${params.newRole} by ${tenantSender.fullName} (${tenantSender.email}).\n\nReason: ${
            params.reason || 'Administrative role realignment'
          }\nAccount Email: ${params.email}\nNew Assigned Role: ${params.newRole}\nWorkspace Login: ${loginUrl}`
        : `Hello ${rec.fullName},\n\nTeam member ${params.fullName} (${params.email}) in ${tenantName} had their role updated from ${params.previousRole} to ${params.newRole} by ${tenantSender.fullName} (${tenantSender.email}).\n\nReason: ${
            params.reason || 'Administrative role realignment'
          }\nWorkspace Login: ${loginUrl}`;

      const record = await this.sendCustomEventEmail({
        tenantId: params.tenantId,
        tenantName,
        recipientUserId: rec.id || params.userId,
        recipientEmail: rec.email,
        recipientName: rec.fullName,
        recipientRole: rec.roleName,
        licenseName: `Role Change (${params.previousRole} → ${params.newRole})`,
        eventType: 'MEMBER_ONBOARDED',
        badgeLabel: 'ROLE UPDATED',
        badgeColor: '#0ea5e9',
        subject,
        headline,
        bodyText,
        detailsRows: [
          { label: 'Organization Workspace', value: tenantName },
          { label: 'Updated Member', value: `${params.fullName} (${params.email})` },
          { label: 'Previous Role', value: params.previousRole },
          { label: 'New Assigned Role', value: params.newRole },
          { label: 'Updated By Admin', value: `${tenantSender.fullName} (${tenantSender.email})` },
          { label: 'Audit Reason', value: params.reason || 'Administrative role realignment' },
        ],
      });

      if (!primaryRecord || isTargetUser) {
        primaryRecord = record;
      }
      if (record.realGmailSent) {
        anyRealSent = true;
      }
      deliveredTo.push(rec.email);
    }

    const notif = {
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'SYSTEM',
      title: headline,
      message: `Automated role update email dispatched to ${deliveredTo.join(', ')}: Role changed from ${params.previousRole} to ${params.newRole}.`,
      isRead: false,
      emailSent: true,
      recipientEmail: deliveredTo.join(', '),
      recipientName: params.fullName,
      createdAt: new Date(),
    };
    mockStore.state.notifications.unshift(notif);
    notificationStreamService.broadcastNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      notification: notif,
    });
    mockStore.saveState();

    return {
      emailRecord: primaryRecord,
      recipients: deliveredTo,
      realGmailSent: anyRealSent,
      notification: notif,
    };
  }

  /**
   * Checks if an identical expiry email was already dispatched recently (within 12 hours)
   * to prevent duplicate background sweeps from spamming the same recipient.
   */
  private hasRecentExpiryEmailBeenSent(
    tenantId: string,
    licenseId: string,
    recipientEmail: string,
    eventType: string
  ): boolean {
    const deliveries = Array.isArray(mockStore.state.emailDeliveries)
      ? mockStore.state.emailDeliveries
      : [];
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    return deliveries.some(
      (d) =>
        d.tenantId === tenantId &&
        d.licenseId === licenseId &&
        d.recipientEmail?.toLowerCase() === recipientEmail.toLowerCase() &&
        d.eventType === eventType &&
        new Date(d.sentAt).getTime() > cutoff
    );
  }

  /**
   * Fully automated background sweep across all active tenants.
   * Ensures that expiring licenses (<= 30 days) automatically dispatch emails
   * to seat holders and admins without any manual button click.
   */
  public async runAutomatedBackgroundExpirySweep(): Promise<void> {
    try {
      const activeTenants = (mockStore.state.tenants || []).filter(
        (t) => t.status === 'ACTIVE' || t.status === 'TRIAL'
      );

      for (const tenant of activeTenants) {
        const tenantId = tenant.id;
        const tenantName = tenant.name || 'Organization';

        const expiringLicenses = (mockStore.state.licenses || []).filter((l) => {
          if (l.tenantId !== tenantId || l.status === 'CANCELLED' || l.deletedAt) return false;
          const rawEnd = l.endDate || l.expiresAt;
          if (!rawEnd) return false;
          const daysLeft = Math.ceil((new Date(rawEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return daysLeft <= 30;
        });

        for (const lic of expiringLicenses) {
          const rawEnd = lic.endDate || lic.expiresAt;
          const endDateObj = new Date(rawEnd);
          const daysLeft = Math.max(
            0,
            Math.ceil((endDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
          const expiryDate: string = endDateObj.toISOString().split('T')[0] || 'N/A';
          const licenseName = lic.name || lic.licenseKey || 'Software License';
          const eventType: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED' =
            daysLeft <= 0
              ? 'EXPIRED'
              : daysLeft <= 7
              ? 'EXPIRY_7'
              : daysLeft <= 15
              ? 'EXPIRY_15'
              : 'EXPIRY_30';

          const recipients = this.getLicenseRecipients(tenantId, lic.id);
          for (const rec of recipients) {
            if (!rec.email) continue;
            if (this.hasRecentExpiryEmailBeenSent(tenantId, lic.id, rec.email, eventType)) {
              continue;
            }

            await this.sendExpiryAlert({
              to: rec.email,
              recipientName: rec.fullName,
              recipientRole: rec.roleName,
              recipientUserId: rec.id,
              tenantId,
              tenantName,
              licenseId: lic.id,
              licenseName,
              daysLeft,
              expiryDate,
              type: eventType,
            });
          }
        }
      }
      mockStore.saveState();
    } catch (err) {
      logger.warn({ err }, 'Background automated expiry email sweep encountered a non-fatal error');
    }
  }

  private schedulerStarted = false;

  public startAutomatedBackgroundScheduler(): void {
    if (this.schedulerStarted || process.env.NODE_ENV === 'test') return;
    this.schedulerStarted = true;

    // Run initial automated check shortly after server startup
    setTimeout(() => {
      this.runAutomatedBackgroundExpirySweep().catch(() => {});
    }, 3500);

    // Repeat automatically every 5 minutes
    const timer = setInterval(() => {
      this.runAutomatedBackgroundExpirySweep().catch(() => {});
    }, 5 * 60 * 1000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
}

export const emailService = new EmailService();



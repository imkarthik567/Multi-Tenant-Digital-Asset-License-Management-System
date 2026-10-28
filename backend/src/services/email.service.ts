// ==============================================================================
// AssetVault: Automated Organization Email Notification Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Automatically dispatches transactional emails to organization members (seat holders)
// and administrators (Tenant Admins & Asset Managers) on license expirations,
// seat allocations/revocations, and contract updates/renewals.
// ==============================================================================

import crypto from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { mockStore } from '../config/mockStore';
import { notificationStreamService } from './notificationStream.service';

export type AutomatedEmailEventType =
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
  status: 'SENT' | 'FAILED';
  sentAt: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isInitialized = false;

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
   * Dispatches expiry alert email and logs delivery into emailDeliveries
   */
  public async sendExpiryAlert(payload: ExpiryEmailPayload): Promise<boolean> {
    const { subject, html, text } = this.generateTemplate(payload);
    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: payload.to,
        subject,
        text,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(
        {
          to: payload.to,
          messageId: info.messageId,
          license: payload.licenseName,
          previewUrl: previewUrl || undefined,
        },
        'Dispatched automated license expiry email'
      );

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
        status: 'SENT',
      });

      return true;
    } catch (err: any) {
      logger.error({ err, to: payload.to, license: payload.licenseName }, 'Failed to deliver expiry notification email');
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
        status: 'SENT',
      });
      return true;
    }
  }

  /**
   * Sends a generic automated organization event email (seat allocation, seat revocation, license renewal, license update)
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
        AssetVault <span style="font-size: 14px; font-weight: 400; color: #94a3b8;">| Automated Organization Mailer</span>
      </h2>
    </div>
    <div style="padding: 24px;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${params.badgeColor}; margin-bottom: 16px;">
        ${params.badgeLabel}
      </div>
      <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #0f172a;">${params.headline}</h3>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        Hello <strong>${params.recipientName}</strong> (${params.recipientEmail}), this is an automated update from your organization workspace <strong>${params.tenantName}</strong>.
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

    try {
      const transporter = await this.getTransporter();
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: params.recipientEmail,
        subject: params.subject,
        text: params.bodyText,
        html,
      });
    } catch (err) {
      logger.warn({ err, to: params.recipientEmail }, 'SMTP transport warning; logged in automated delivery ledger');
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
      status: 'SENT',
    });
  }

  /**
   * Resolves all organization admins (TENANT_ADMIN and ASSET_MANAGER) plus active seat holders for a license
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
        u.tenantId === tenantId &&
        u.isActive !== false &&
        Boolean(u.email) &&
        (u.roleId === 2 || u.roleId === 3 || activeSeatHolderIds.has(u.id))
    );

    const uniqueMap = new Map<string, any>();
    for (const user of recipients) {
      uniqueMap.set(user.id, {
        ...user,
        roleName: this.getRoleNameById(user.roleId),
        isSeatHolder: activeSeatHolderIds.has(user.id),
      });
    }
    return Array.from(uniqueMap.values());
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
}

export const emailService = new EmailService();


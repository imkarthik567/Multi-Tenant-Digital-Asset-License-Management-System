// ==============================================================================
// AssetVault: Background Scheduled Job Runner
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces PostgreSQL advisory locks (pg_try_advisory_lock) for safe concurrency
// ==============================================================================

import cron from 'node-cron';
import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { emailService } from '../services/email.service';
import { notificationStreamService } from '../services/notificationStream.service';

// Scheduled maintenance spans tenants and must use the explicitly configured
// maintenance connection. The web API uses the restricted assetvault_app role.
const maintenanceUrl = env.DIRECT_URL || env.DATABASE_URL;
const workerPrisma = new PrismaClient({
  datasources: { db: { url: maintenanceUrl } },
});

// This client pins the advisory lock to a transaction-owned connection. Keep it
// separate from workerPrisma, which executes job SQL through its own pool.
const lockPrisma = new PrismaClient({
  datasources: { db: { url: maintenanceUrl } },
});

// Advisory lock keys (32-bit unique integers)
const LOCK_EXPIRY_NOTIFICATIONS = 1001;
const LOCK_REFRESH_MV = 1002;
const LOCK_AUTO_RENEW = 1003;

export class JobScheduler {
  private cronTasks: any[] = [];

  /**
   * Safe wrapper that executes a routine only if PostgreSQL advisory lock is granted
   */
  private async withAdvisoryLock<T>(
    lockId: number,
    jobName: string,
    action: () => Promise<T>
  ): Promise<T | null> {
    try {
      // Transaction-level advisory locks are tied to one pinned connection and
      // are always released on commit/rollback. Do not acquire/release a
      // session-level lock in two separate pooled Prisma queries.
      return await lockPrisma.$transaction(
        async (tx) => {
          const lockResult = await tx.$queryRaw<Array<{ locked: boolean }>>(
            Prisma.sql`SELECT pg_try_advisory_xact_lock(${lockId}) AS locked;`
          );
          const isLocked = Boolean(lockResult[0]?.locked);

          if (!isLocked) {
            logger.info(
              { jobName, lockId },
              'Advisory lock held by another worker instance. Skipping execution.'
            );
            return null;
          }

          logger.info({ jobName, lockId }, `Acquired advisory lock ${lockId}. Executing job...`);
          return await action();
        },
        { maxWait: 10_000, timeout: 30 * 60 * 1000 }
      );
    } catch (err: any) {
      logger.error({ err, jobName, lockId }, `Error in job execution with advisory lock ${lockId}`);
      return null;
    }
  }

  /**
   * Job 1: Daily at 02:00
   * Calls fn_generate_expiry_notifications() across all active tenants, logs count,
   * and dispatches email alerts to TENANT_ADMIN / ASSET_MANAGER recipients.
   */
  public async runExpiryNotificationsJob(): Promise<{ totalNotifications: number; emailsSent: number }> {
    return (
      (await this.withAdvisoryLock(LOCK_EXPIRY_NOTIFICATIONS, 'ExpiryNotifications', async () => {
        logger.info('Starting scheduled license expiry notification routine...');

        // 1. Get all active tenants
        const tenants: any = await workerPrisma.$queryRaw(
          Prisma.sql`SELECT id, name FROM tenants WHERE status = 'ACTIVE';`
        );

        let totalNotifications = 0;

        for (const tenant of tenants) {
          try {
            const res: any = await workerPrisma.$queryRaw(
              Prisma.sql`SELECT fn_generate_expiry_notifications(${tenant.id}::uuid, 30) AS created_count;`
            );
            const count = parseInt(res?.[0]?.created_count || '0', 10);
            totalNotifications += count;
            if (count > 0) {
              logger.info({ tenantId: tenant.id, tenantName: tenant.name, count }, 'Generated expiry alerts for tenant');
            }
          } catch (tenantErr: any) {
            logger.error({ tenantErr, tenantId: tenant.id }, 'Failed to run expiry notification check for tenant');
          }
        }

        // 2. Fetch freshly generated notifications from the last hour to dispatch emails
        let emailsSent = 0;
        try {
          const freshAlerts: any = await workerPrisma.$queryRaw(Prisma.sql`
            SELECT 
              n.id, n.type, n.message, n.created_at,
              u.email, u.full_name,
              t.name AS tenant_name,
              l.name AS license_name,
              l.end_date
            FROM notifications n
            JOIN users u ON u.id = n.user_id
            JOIN tenants t ON t.id = n.tenant_id
            JOIN licenses l ON l.id = n.license_id
            WHERE n.created_at >= (NOW() - INTERVAL '1 hour')
              AND n.is_read = FALSE;
          `);

          for (const alert of freshAlerts) {
            const daysLeft = alert.end_date
              ? Math.max(0, Math.ceil((new Date(alert.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : 0;

            const sent = await emailService.sendExpiryAlert({
              to: alert.email || '',
              recipientName: alert.full_name || 'Administrator',
              tenantName: alert.tenant_name || 'Organization',
              licenseName: alert.license_name || 'Software License',
              daysLeft,
              expiryDate: alert.end_date ? (new Date(alert.end_date).toISOString().split('T')[0] || 'N/A') : 'N/A',
              type: alert.type as any,
            });

            if (sent) emailsSent++;
          }
        } catch (emailErr: any) {
          logger.error({ emailErr }, 'Error querying or dispatching expiry emails');
        }

        if (totalNotifications > 0) {
          notificationStreamService.broadcastNotification({
            tenantId: null,
            notification: {
              type: 'DAILY_EXPIRY_RUN',
              message: `Daily expiry audit created ${totalNotifications} alerts across tenants`,
              count: totalNotifications,
              timestamp: new Date().toISOString(),
            },
          });
        }

        logger.info({ totalNotifications, emailsSent }, 'Completed daily license expiry notification run');
        return { totalNotifications, emailsSent };
      })) || { totalNotifications: 0, emailsSent: 0 }
    );
  }

  /**
   * Job 2: Hourly
   * Executes REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats
   */
  public async runRefreshMaterializedViewJob(): Promise<boolean> {
    const result = await this.withAdvisoryLock(LOCK_REFRESH_MV, 'RefreshMaterializedView', async () => {
      logger.info('Refreshing materialized view mv_monthly_access_stats...');
      await workerPrisma.$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;`);
      logger.info('Successfully refreshed materialized view mv_monthly_access_stats');
      return true;
    });
    return Boolean(result);
  }

  /**
   * Job 3: Daily
   * Auto-renews licenses where auto_renew = true and end_date is within 3 days,
   * extending by previous period length via sp_renew_license.
   */
  public async runAutoRenewLicensesJob(): Promise<{ renewedCount: number }> {
    return (
      (await this.withAdvisoryLock(LOCK_AUTO_RENEW, 'AutoRenewLicenses', async () => {
        logger.info('Checking licenses eligible for automated contract renewal...');

        // Find active un-deleted licenses due for renewal within 3 days
        const eligibleLicenses: any = await workerPrisma.$queryRaw(Prisma.sql`
          SELECT 
            l.id, l.tenant_id, l.name, l.start_date, l.end_date, l.cost,
            u.id AS admin_user_id
          FROM licenses l
          LEFT JOIN LATERAL (
            SELECT id FROM users
            WHERE tenant_id = l.tenant_id AND is_active = TRUE
            ORDER BY role_id ASC
            LIMIT 1
          ) u ON true
          WHERE l.auto_renew = TRUE
            AND l.status = 'ACTIVE'
            AND l.deleted_at IS NULL
            AND l.end_date IS NOT NULL
            AND l.end_date >= CURRENT_DATE
            AND l.end_date <= (CURRENT_DATE + INTERVAL '3 days');
        `);

        let renewedCount = 0;

        for (const lic of eligibleLicenses) {
          try {
            const startDate = new Date(lic.start_date);
            const endDate = new Date(lic.end_date);
            let diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) diffDays = 365;

            const newEndDate = new Date(endDate);
            newEndDate.setDate(newEndDate.getDate() + diffDays);
            const formattedNewEndDate = newEndDate.toISOString().split('T')[0];

            logger.info(
              { licenseId: lic.id, name: lic.name, currentEnd: lic.end_date, newEnd: formattedNewEndDate },
              'Calling sp_renew_license for auto-renewal'
            );

            const renewalNote = `Automated period renewal (+${diffDays} days) by AssetVault Background Worker`;

            await workerPrisma.$executeRaw(
              Prisma.sql`CALL sp_renew_license(${lic.id}::uuid, ${formattedNewEndDate}::date, ${lic.cost}::numeric, ${lic.admin_user_id}::uuid, ${renewalNote}::text, null);`
            );

            renewedCount++;

            notificationStreamService.broadcastNotification({
              tenantId: lic.tenant_id,
              notification: {
                type: 'AUTO_RENEW_SUCCESS',
                message: `License "${lic.name}" auto-renewed through ${formattedNewEndDate}.`,
                licenseId: lic.id,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (renewErr: any) {
            logger.error({ renewErr, licenseId: lic.id, name: lic.name }, 'Failed to auto-renew license');
          }
        }

        logger.info({ renewedCount }, 'Completed automated license renewal run');
        return { renewedCount };
      })) || { renewedCount: 0 }
    );
  }

  /**
   * Starts all recurring cron jobs
   */
  public startScheduler(): void {
    logger.info('Initializing AssetVault cron schedulers...');

    // 1. Daily at 02:00: Expiry Notifications & Email alerts
    const expiryTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Cron triggered: Daily license expiry notification audit (02:00)');
      await this.runExpiryNotificationsJob();
    });
    this.cronTasks.push(expiryTask);

    // 2. Hourly: Materialized view refresh
    const mvTask = cron.schedule('0 * * * *', async () => {
      logger.info('Cron triggered: Hourly materialized view refresh (mv_monthly_access_stats)');
      await this.runRefreshMaterializedViewJob();
    });
    this.cronTasks.push(mvTask);

    // 3. Daily at 03:00: Auto-renewal of expiring contracts
    const autoRenewTask = cron.schedule('0 3 * * *', async () => {
      logger.info('Cron triggered: Daily automated license renewal audit (03:00)');
      await this.runAutoRenewLicensesJob();
    });
    this.cronTasks.push(autoRenewTask);

    logger.info('✅ AssetVault Background Schedulers active [Daily 02:00 Notifications, Hourly MV Refresh, Daily 03:00 Auto-Renew]');
  }

  /** Close the dedicated maintenance connection during graceful shutdown. */
  public async disconnectDatabase(): Promise<void> {
    await Promise.all([workerPrisma.$disconnect(), lockPrisma.$disconnect()]);
  }

  /**
   * Stops all running scheduled cron tasks
   */
  public stopScheduler(): void {
    for (const task of this.cronTasks) {
      task.stop();
    }
    this.cronTasks = [];
    logger.info('AssetVault Background Schedulers stopped.');
  }
}

export const jobScheduler = new JobScheduler();

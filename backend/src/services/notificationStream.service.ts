// ==============================================================================
// AssetVault: Server-Sent Events (SSE) Real-Time Notification Bus
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides: Instant push notifications to frontend bell icon via GET /api/notifications/stream
// ==============================================================================

import { Response } from 'express';
import { EventEmitter } from 'events';
import { logger } from '../config/logger';
import { sseActiveConnectionsGauge } from '../middleware/observability.middleware';

interface SSEClient {
  id: string;
  userId: string;
  tenantId: string | null;
  res: Response;
}

class NotificationStreamService extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        try {
          client.res.write(': keepalive-ping\n\n');
        } catch (err) {
          this.removeClient(client.id);
        }
      }
    }, 25000);
  }

  /**
   * Registers an authenticated SSE connection
   */
  public registerClient(clientId: string, userId: string, tenantId: string | null, res: Response): void {
    // Write SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send connection established event
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    this.clients.set(clientId, { id: clientId, userId, tenantId, res });
    sseActiveConnectionsGauge.set(this.clients.size);
    logger.info({ clientId, userId, tenantId, totalConnected: this.clients.size }, 'SSE client connected to notification stream');

    res.on('close', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Removes disconnected client
   */
  public removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      sseActiveConnectionsGauge.set(this.clients.size);
      logger.info({ clientId, remainingConnected: this.clients.size }, 'SSE client disconnected from notification stream');
    }
  }

  /**
   * Broadcasts real-time notification to matching user or tenant
   */
  public broadcastNotification(payload: {
    tenantId: string | null;
    userId?: string;
    notification: any;
  }): void {
    const { tenantId, userId, notification } = payload;
    const ssePayload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;

    let deliveredCount = 0;
    for (const client of this.clients.values()) {
      const tenantMatch = !client.tenantId || !tenantId || client.tenantId === tenantId;
      const userMatch = !userId || client.userId === userId;

      if (tenantMatch && userMatch) {
        try {
          client.res.write(ssePayload);
          deliveredCount++;
        } catch (err) {
          this.removeClient(client.id);
        }
      }
    }

    logger.debug({ deliveredCount, userId, tenantId }, 'Dispatched real-time SSE notification');
  }
}

export const notificationStreamService = new NotificationStreamService();

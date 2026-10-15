// ==============================================================================
// AssetVault: Notification Center Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Expiry alerts, seat threshold warnings, and manual automated check trigger
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Clock,
  ShieldAlert,
  Info,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Pagination } from '../../components/common/Pagination';
import { RoleGate } from '../../components/auth/RoleGate';

export const NotificationListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [filterRead, setFilterRead] = useState<string>(''); // '', 'false', 'true'

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery<{
    data: Notification[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['notifications', page, limit, filterRead],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[]; meta: any }>('/notifications', {
        params: {
          page,
          limit,
          isRead: filterRead || undefined,
        },
      });
      return res;
    },
  });

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      toast({ title: 'Success', message: 'All notifications marked as read', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Run automated license expiry check
  const runExpiryCheckMutation = useMutation({
    mutationFn: () => api.post('/notifications/run-expiry-check', { lookaheadDays: 30 }),
    onSuccess: (data: any) => {
      toast({
        title: 'Expiry Check Completed',
        message: data.message || 'Scanned for licenses expiring within 30 days',
        type: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Execution Error',
        message: err.message || 'Failed to execute expiry check procedure',
        type: 'error',
      });
    },
  });

  const notifications = notificationsData?.data || [];
  const meta = notificationsData?.meta || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'EXPIRY_30':
      case 'EXPIRY_15':
      case 'LICENSE_EXPIRY':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'EXPIRY_7':
      case 'EXPIRED':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'OVER_ALLOCATION':
      case 'SEAT_LIMIT':
        return <ShieldAlert className="w-5 h-5 text-purple-500" />;
      case 'SYSTEM':
      default:
        return <Info className="w-5 h-5 text-primary-500" />;
    }
  };

  const getNotificationTitle = (n: Notification) => {
    if (n.title) return n.title;
    switch (n.type) {
      case 'EXPIRY_7':
        return 'Critical: License Expiring Within 7 Days';
      case 'EXPIRY_15':
        return 'Warning: License Expiring Within 15 Days';
      case 'EXPIRY_30':
        return 'Notice: License Expiring Within 30 Days';
      case 'EXPIRED':
        return 'Alert: License Expired';
      case 'OVER_ALLOCATION':
        return 'Seat Capacity Alert';
      case 'SYSTEM':
      default:
        return 'System Notification';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Security & Expiry Alerts
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time compliance monitoring, license expiration warnings, and quota alerts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Admin Manual Check Trigger */}
          <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER', 'SUPER_ADMIN']}>
            <button
              onClick={() => runExpiryCheckMutation.mutate()}
              disabled={runExpiryCheckMutation.isPending}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 text-primary-500 ${
                  runExpiryCheckMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              Run Expiry Check
            </button>
          </RoleGate>

          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || notifications.length === 0}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2">
        <button
          onClick={() => {
            setFilterRead('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterRead === ''
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilterRead('false');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterRead === 'false'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          Unread
        </button>
        <button
          onClick={() => {
            setFilterRead('true');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterRead === 'true'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          Read
        </button>
      </div>

      {/* Notification Stream */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          message="You are completely up-to-date. No pending security alerts or license notices."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                !n.isRead
                  ? 'bg-white dark:bg-slate-900 border-primary-300 dark:border-primary-800/80 shadow-sm'
                  : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-start space-x-3.5">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {getNotificationTitle(n)}
                    </h4>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString()} &bull; Type: <span className="font-mono">{n.type}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:self-center shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => markReadMutation.mutate(n.id)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  >
                    Mark Read
                  </button>
                )}
                {n.licenseId && (
                  <a
                    href={`/licenses/${n.licenseId}`}
                    className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded transition-colors"
                    title="View Related License"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          </div>
        </div>
      )}
    </div>
  );
};

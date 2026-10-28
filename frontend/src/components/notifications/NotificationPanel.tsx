// ==============================================================================
// AssetVault: Modern Slide-Over Notification & Automated Email Delivery Panel
// Course: BCSE307L Database Systems (Fall 2026-27)
// Slide-over right drawer, 5 tabs (All, Unread, Expiring, System, Auto-Emails),
// Colored type icons (rose=EXPIRED, amber=EXPIRY_7/15, blue=EXPIRY_30),
// Automated Email Delivery Log showing recipient member email, role, event type,
// subject, expandable email body, and real-time SSE listener.
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  X,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Info,
  Users2,
  RefreshCw,
  KeyRound,
  Calendar,
  Check,
  Mail,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import { api } from '../../services/api';
import { Notification, AutomatedEmailLog } from '../../types';
import { useToast } from '../../context/ToastContext';
import { NotificationStreamClient } from '../../services/notificationStream';
import { Badge, Skeleton } from '../ui';

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export type NotificationTab = 'all' | 'unread' | 'expiring' | 'system' | 'emails';

// ==============================================================================
// 1. Helper: Relative Time Formatter
// ==============================================================================

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) return 'Just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 5) return `${diffInWeeks}w ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

// ==============================================================================
// 2. Helper: Notification & Email Event Type Metadata
// ==============================================================================

export function getNotificationTypeMeta(type: string) {
  switch (type) {
    case 'EXPIRED':
      return {
        icon: AlertOctagon,
        badgeClass: 'text-rose-400 bg-zinc-900 border-zinc-700',
        dotClass: 'bg-rose-400',
        label: 'Expired',
      };
    case 'EXPIRY_7':
    case 'EXPIRY_15':
      return {
        icon: AlertTriangle,
        badgeClass: 'text-amber-400 bg-zinc-900 border-zinc-700',
        dotClass: 'bg-amber-400',
        label: type === 'EXPIRY_7' ? 'Expires in 7d' : 'Expires in 15d',
      };
    case 'EXPIRY_30':
    case 'LICENSE_EXPIRY':
      return {
        icon: Calendar,
        badgeClass: 'text-blue-400 bg-zinc-900 border-zinc-800',
        dotClass: 'bg-blue-400',
        label: 'Expires in 30d',
      };
    case 'SEAT_ALLOCATED':
      return {
        icon: Users2,
        badgeClass: 'text-white bg-zinc-900 border-zinc-700',
        dotClass: 'bg-white',
        label: 'Seat Allocated',
      };
    case 'SEAT_REVOKED':
      return {
        icon: Users2,
        badgeClass: 'text-zinc-300 bg-zinc-900 border-zinc-800',
        dotClass: 'bg-zinc-400',
        label: 'Seat Released',
      };
    case 'LICENSE_RENEWED':
    case 'LICENSE_UPDATED':
      return {
        icon: KeyRound,
        badgeClass: 'text-white bg-zinc-900 border-zinc-700',
        dotClass: 'bg-white',
        label: type === 'LICENSE_RENEWED' ? 'Contract Renewed' : 'Contract Updated',
      };
    case 'OVER_ALLOCATION':
    case 'SEAT_LIMIT':
      return {
        icon: Users2,
        badgeClass: 'text-zinc-200 bg-zinc-900 border-zinc-700',
        dotClass: 'bg-zinc-300',
        label: 'Seat Quota Alert',
      };
    case 'SYSTEM':
    default:
      return {
        icon: Info,
        badgeClass: 'text-indigo-300 bg-zinc-900 border-zinc-800',
        dotClass: 'bg-zinc-400',
        label: 'System Notice',
      };
  }
}

// ==============================================================================
// 3. NotificationPanel Component
// ==============================================================================

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  // Active Tab State: All, Unread, Expiring, System, Auto-Emails
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Real-time incoming notifications from SSE
  const [liveNotifications, setLiveNotifications] = useState<Notification[]>([]);
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(new Set());

  // Mobile pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ============================================================================
  // Data Queries
  // ============================================================================

  const {
    data: notifResponse,
    isLoading,
    refetch,
  } = useQuery<{ data: Notification[] } | Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>('/notifications', {
        params: { limit: 50 },
      });
      return res;
    },
    enabled: isOpen,
  });

  const {
    data: emailLogsResponse,
    isLoading: isEmailLogsLoading,
    refetch: refetchEmailLogs,
  } = useQuery<{ data: AutomatedEmailLog[] } | AutomatedEmailLog[]>({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const res = await api.get<{ data: AutomatedEmailLog[] }>('/notifications/email-logs');
      return res;
    },
    enabled: isOpen,
  });

  const emailLogs: AutomatedEmailLog[] = useMemo(() => {
    if (!emailLogsResponse) return [];
    if (Array.isArray(emailLogsResponse)) return emailLogsResponse;
    return (emailLogsResponse as any)?.data || [];
  }, [emailLogsResponse]);

  const serverNotifications: Notification[] = useMemo(() => {
    if (!notifResponse) return [];
    if (Array.isArray(notifResponse)) return notifResponse;
    return (notifResponse as any)?.data || [];
  }, [notifResponse]);

  // Combined notifications (merging live SSE arrivals + server response)
  const allNotifications = useMemo(() => {
    const map = new Map<string, Notification>();
    for (const n of liveNotifications) {
      map.set(n.id, n);
    }
    for (const n of serverNotifications) {
      if (!map.has(n.id)) {
        map.set(n.id, n);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [liveNotifications, serverNotifications]);

  // Tab Filtering Counts
  const counts = useMemo(() => {
    const total = allNotifications.length;
    const unread = allNotifications.filter((n) => !n.isRead).length;
    const expiring = allNotifications.filter((n) =>
      ['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'LICENSE_EXPIRY'].includes(
        n.type
      )
    ).length;
    const system = allNotifications.filter(
      (n) =>
        ['SYSTEM', 'OVER_ALLOCATION', 'SEAT_LIMIT'].includes(n.type) ||
        !['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'LICENSE_EXPIRY'].includes(
          n.type
        )
    ).length;
    const emails = emailLogs.length;
    return { total, unread, expiring, system, emails };
  }, [allNotifications, emailLogs]);

  // Filtered Notifications based on activeTab
  const displayedNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return allNotifications.filter((n) => !n.isRead);
      case 'expiring':
        return allNotifications.filter((n) =>
          [
            'EXPIRY_30',
            'EXPIRY_15',
            'EXPIRY_7',
            'EXPIRED',
            'LICENSE_EXPIRY',
          ].includes(n.type)
        );
      case 'system':
        return allNotifications.filter(
          (n) =>
            ['SYSTEM', 'OVER_ALLOCATION', 'SEAT_LIMIT'].includes(n.type) ||
            ![
              'EXPIRY_30',
              'EXPIRY_15',
              'EXPIRY_7',
              'EXPIRED',
              'LICENSE_EXPIRY',
            ].includes(n.type)
        );
      case 'all':
      default:
        return allNotifications;
    }
  }, [allNotifications, activeTab]);

  // ============================================================================
  // SSE Real-time Updates: Connect to GET /api/notifications/stream on panel open
  // ============================================================================

  useEffect(() => {
    if (!isOpen) return;

    const streamClient = new NotificationStreamClient({
      onNotification: (payload: any) => {
        const incomingId = payload.id || `notif-stream-${Date.now()}`;
        const newNotif: Notification = {
          id: incomingId,
          tenantId: payload.tenantId || '',
          userId: payload.userId,
          licenseId: payload.licenseId,
          type: payload.type || 'SYSTEM',
          title: payload.title || 'New Alert',
          message: payload.message || '',
          isRead: false,
          emailSent: payload.emailSent ?? true,
          recipientEmail: payload.recipientEmail,
          createdAt: payload.createdAt || new Date().toISOString(),
          ...(payload.license ? { license: payload.license } : {}),
        };

        setNewArrivalIds((prev) => new Set(prev).add(incomingId));

        setLiveNotifications((prev) => [
          newNotif,
          ...prev.filter((item) => item.id !== incomingId),
        ]);

        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      },
    });

    streamClient.start();

    return () => {
      streamClient.stop();
    };
  }, [isOpen, queryClient]);

  // ============================================================================
  // Mutations: Optimistic Mark as Read & Automated Expiry Email Scan
  // ============================================================================

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onMutate: async (id: string) => {
      setLiveNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );

      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData(['notifications']);

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((n: Notification) =>
            n.id === id ? { ...n, isRead: true } : n
          );
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((n: Notification) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
          };
        }
        return old;
      });

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onMutate: async () => {
      setLiveNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );

      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData(['notifications']);

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((n: Notification) => ({ ...n, isRead: true }));
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((n: Notification) => ({ ...n, isRead: true })),
          };
        }
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
      toast.error('Failed to mark all notifications as read');
    },
    onSuccess: () => {
      toast.success('All notifications marked as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Trigger Automated License Expiry Scan & Member Email Dispatch
  const runExpiryCheckMutation = useMutation({
    mutationFn: () =>
      api.post('/notifications/run-expiry-check', { lookaheadDays: 30 }),
    onSuccess: (data: any) => {
      const payload = data?.data || data || {};
      const emailsSent = payload.emailsSent || 0;
      const recipients: string[] = payload.recipients || [];
      toast.success(
        emailsSent > 0
          ? `Dispatched ${emailsSent} automated expiry email(s) to organization members (${recipients.join(', ')})`
          : 'Scanned contracts: All active licenses are compliant'
      );
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to execute automated expiry email scan');
    },
  });

  // ============================================================================
  // Mobile Pull-to-Refresh Handlers
  // ============================================================================

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;

    if (delta > 0 && scrollContainerRef.current?.scrollTop === 0) {
      const distance = Math.min(delta * 0.45, 80);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;

    if (pullDistance >= 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await Promise.all([refetch(), refetchEmailLogs()]);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="notification-panel">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Right Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-50">
        <div className="relative w-screen max-w-md bg-[#0b1120] border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* ================================================================== */}
          {/* 1. Header: Title, Unread Count, Auto-Email Log Switch, Close       */}
          {/* ================================================================== */}
          <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-800 bg-[#030712] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white tracking-tight">
                    Notifications
                  </h2>
                  {counts.unread > 0 && (
                    <Badge variant="info" size="sm" className="font-mono tabular-nums text-[10px] py-0 px-1.5 font-bold">
                      {counts.unread} New
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Automated organization emails &amp; expiry alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Switch to Automated Email Delivery Log */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'emails' ? 'all' : 'emails')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'emails'
                    ? 'text-white bg-indigo-600 border-indigo-500'
                    : 'text-slate-300 hover:text-white bg-[#131c31] hover:bg-slate-800 border-slate-700'
                }`}
                title="View automated emails sent to organization members"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{counts.emails} Sent</span>
              </button>

              {/* Mark all as read button */}
              {counts.unread > 0 && activeTab !== 'emails' && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#131c31] rounded-lg transition-colors cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Mark all as read</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#131c31] transition-colors cursor-pointer"
                aria-label="Close notification panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ================================================================== */}
          {/* 2. Tabs: All, Unread, Expiring, System, Auto-Emails                */}
          {/* ================================================================== */}
          <div className="flex items-center border-b border-slate-800 bg-[#030712] text-xs px-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All', count: counts.total },
              { id: 'unread', label: 'Unread', count: counts.unread },
              { id: 'expiring', label: 'Expiring', count: counts.expiring },
              { id: 'system', label: 'System', count: counts.system },
              { id: 'emails', label: 'Auto-Emails', count: counts.emails },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as NotificationTab)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-indigo-500 text-indigo-300 bg-indigo-950/30'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#131c31]/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ================================================================== */}
          {/* 3. Pull-To-Refresh Indicator (Mobile Touch)                        */}
          {/* ================================================================== */}
          {pullDistance > 0 && (
            <div
              className="flex items-center justify-center gap-2 py-2 text-xs text-indigo-400 bg-indigo-950/30 border-b border-indigo-900/40 transition-all overflow-hidden"
              style={{ height: `${pullDistance}px` }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? 'animate-spin' : pullDistance >= 50 ? 'rotate-180' : ''
                } transition-transform duration-200`}
              />
              <span className="font-semibold text-[11px]">
                {isRefreshing
                  ? 'Refreshing notifications...'
                  : pullDistance >= 50
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
              </span>
            </div>
          )}

          {/* ================================================================== */}
          {/* 4. Notification List OR Automated Email Delivery Log               */}
          {/* ================================================================== */}
          <div
            ref={scrollContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y-0"
          >
            {activeTab === 'emails' ? (
              isEmailLogsLoading ? (
                <div className="space-y-3 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="card" className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center my-auto min-h-[340px] space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-indigo-400">
                    <Mail className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-100">
                      No Automated Emails Logged Yet
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Click &ldquo;Scan Expirations &amp; Auto-Email&rdquo; below or allocate/renew a license to automatically send emails to organization members.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="px-1 pb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Automated emails sent to organization members &amp; admins</span>
                    <span className="font-mono tabular-nums text-emerald-400">{emailLogs.length} delivered</span>
                  </div>
                  {emailLogs.map((log) => {
                    const meta = getNotificationTypeMeta(log.eventType);
                    const IconComponent = meta.icon;
                    const isExpanded = expandedEmailId === log.id;
                    const relativeTime = formatRelativeTime(log.sentAt);

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-colors space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${meta.badgeClass}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-100 truncate">
                                  {log.recipientName}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {log.recipientRole}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-indigo-400 truncate mt-0.5">
                                To: {log.recipientEmail}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 font-mono tabular-nums">
                              <Send className="w-2.5 h-2.5" />
                              {log.status}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
                              {relativeTime}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-200 leading-snug">
                          {log.subject}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-400 truncate max-w-[210px]">
                            License: <span className="text-slate-300 font-medium">{log.licenseName}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedEmailId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Email Body' : 'Preview Email'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-line leading-relaxed">
                            {log.bodyText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : isLoading ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="card" className="h-24 rounded-xl" />
                ))}
              </div>
            ) : displayedNotifications.length === 0 ? (
              /* Empty State: Animated Bell + "You're all caught up" */
              <div className="flex flex-col items-center justify-center p-10 text-center my-auto min-h-[340px] space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-400 shadow-inner">
                    <Bell className="w-8 h-8 text-indigo-400 animate-bounce" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-slate-900 flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">
                    You&apos;re all caught up
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    No notifications in this view right now. Check back later for license renewals and quota advisories.
                  </p>
                </div>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const meta = getNotificationTypeMeta(n.type);
                const IconComponent = meta.icon;
                const relativeTime = formatRelativeTime(n.createdAt);
                const isNew = newArrivalIds.has(n.id);

                const licenseName =
                  (n as any).license?.name ||
                  n.title ||
                  (n.message || '').match(/license\s+['"]?([^'"]+)['"]?/i)?.[1] ||
                  'Enterprise License';

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) {
                        markReadMutation.mutate(n.id);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                      isNew ? 'animate-in slide-in-from-top-3 duration-300 ring-1 ring-indigo-500/50' : ''
                    } ${
                      !n.isRead
                        ? 'bg-slate-900 border-indigo-900/60 hover:bg-slate-850 hover:border-indigo-700/70 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/70 hover:bg-slate-900/80 hover:border-slate-700 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Colored Type Icon */}
                      <div
                        className={`p-2 rounded-xl border shrink-0 mt-0.5 ${meta.badgeClass}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {/* Content Column */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {/* License Name Chip */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 truncate max-w-[200px]">
                            <KeyRound className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">{licenseName}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Relative Timestamp */}
                            <span className="text-[10px] text-slate-500 font-mono tabular-nums flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{relativeTime}</span>
                            </span>

                            {/* Unread Dot Indicator */}
                            {!n.isRead && (
                              <span
                                className="w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-indigo-400/40 shrink-0 animate-pulse ml-0.5"
                                title="Unread alert"
                              />
                            )}
                          </div>
                        </div>

                        {/* Message Text */}
                        <p className="text-xs text-slate-200 font-medium leading-relaxed select-text">
                          {n.message}
                        </p>

                        {/* Automated Email Delivery Status */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {n.recipientEmail
                                ? `Auto-emailed to ${n.recipientEmail}`
                                : 'Auto-email delivery active'}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab('emails');
                            }}
                            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline shrink-0 cursor-pointer"
                          >
                            Delivery Log &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ================================================================== */}
          {/* 5. Footer: Automated Expiry Scan & Email Dispatch Action           */}
          {/* ================================================================== */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-Email Engine Active</span>
            </span>

            <button
              type="button"
              onClick={() => runExpiryCheckMutation.mutate()}
              disabled={runExpiryCheckMutation.isPending}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Scan expiring licenses and automatically email assigned seat holders and organization admins"
            >
              <RefreshCw
                className={`w-3 h-3 ${
                  runExpiryCheckMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              <span>
                {runExpiryCheckMutation.isPending
                  ? 'Dispatching Emails...'
                  : 'Scan Expirations & Auto-Email'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


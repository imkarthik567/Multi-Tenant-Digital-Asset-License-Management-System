// ==============================================================================
// AssetVault: Enterprise Analytics & Reporting Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Visualizes Advanced Views, Stored Procedures, Window Functions, and MV
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Download,
  AlertTriangle,
  Store,
  Activity,
  Award,
  Coins,
  UserX,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { api } from '../../services/api';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';

export const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    'utilization' | 'vendor_spend' | 'monthly_spend' | 'top_assets' | 'unlicensed' | 'trends' | 'cost_optimization'
  >('utilization');

  // 1. License Utilization View
  const { data: utilizationData = [], isLoading: isUtilLoading } = useQuery({
    queryKey: ['reports', 'license-utilization'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/license-utilization');
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        id: r.license_id || r.id,
        license_id: r.license_id || r.id,
        name: r.license_name || r.name,
        license_name: r.license_name || r.name,
      }));
    },
    enabled: activeTab === 'utilization',
  });

  // 2. Vendor Spend View
  const { data: vendorSpendData = [], isLoading: isVendorLoading } = useQuery({
    queryKey: ['reports', 'vendor-spend'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/vendor-spend');
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        total_cost: Number(r.grand_total_spend ?? r.total_cost ?? 0),
        renewal_cost: Number(r.total_renewal_cost ?? r.renewal_cost ?? 0),
        grand_total_spend: Number(r.grand_total_spend ?? r.total_cost ?? 0),
        total_renewal_cost: Number(r.total_renewal_cost ?? r.renewal_cost ?? 0),
      }));
    },
    enabled: activeTab === 'vendor_spend',
  });

  // 3. Spend by Month (Window Function Running Total)
  const { data: monthlySpendData = [], isLoading: isMonthlyLoading } = useQuery({
    queryKey: ['reports', 'spend-by-month'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/spend-by-month');
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        month: r.month_year || r.month,
        month_year: r.month_year || r.month,
        running_total: Number(r.running_total_spend ?? r.running_total ?? 0),
        running_total_spend: Number(r.running_total_spend ?? r.running_total ?? 0),
        monthly_spend: Number(r.monthly_spend ?? 0),
      }));
    },
    enabled: activeTab === 'monthly_spend',
  });

  // 4. Top Assets (Window Function Rank)
  const { data: topAssetsData = [], isLoading: isTopLoading } = useQuery({
    queryKey: ['reports', 'top-assets'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/top-assets');
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        id: r.asset_id || r.id,
        asset_id: r.asset_id || r.id,
        name: r.asset_name || r.name,
        asset_name: r.asset_name || r.name,
        rank: r.download_rank || r.rank,
        download_rank: r.download_rank || r.rank,
      }));
    },
    enabled: activeTab === 'top_assets',
  });

  // 5. Unlicensed Assets
  const { data: unlicensedData = [], isLoading: isUnlicensedLoading } = useQuery({
    queryKey: ['reports', 'unlicensed-assets'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/unlicensed-assets');
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        id: r.asset_id || r.id,
        asset_id: r.asset_id || r.id,
        name: r.asset_name || r.name,
        asset_name: r.asset_name || r.name,
      }));
    },
    enabled: activeTab === 'unlicensed',
  });

  // 6. Access Trends (Materialized View mv_monthly_access_stats)
  const { data: accessTrendsData = [], isLoading: isTrendsLoading } = useQuery({
    queryKey: ['reports', 'access-trend'],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/access-trend');
      return Array.isArray(res) ? res : (res as any).data || [];
    },
    enabled: activeTab === 'trends',
  });

  // 7. Cost Optimization & Dormant Seat Reclamation
  const {
    data: costOptData,
    isLoading: isCostOptLoading,
    refetch: refetchCostOpt,
  } = useQuery({
    queryKey: ['reports', 'unused-seats'],
    queryFn: async () => {
      const res = await api.get<any>('/reports/unused-seats');
      return (res as any)?.data || res;
    },
    enabled: activeTab === 'cost_optimization',
  });

  // 1-Click Release Seat Mutation (uses sp_release_license_seat)
  const releaseSeatMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return api.post(`/allocations/${allocationId}/release`, {
        reason: 'Cost optimization: Dormant seat reclaimed (>30 days inactive)',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Seat Reclaimed',
        message: 'Successfully released license seat using sp_release_license_seat.',
        type: 'success',
      });
      refetchCostOpt();
    },
    onError: (err: any) => {
      toast({
        title: 'Release Failed',
        message: err.message || 'Failed to release seat allocation.',
        type: 'error',
      });
    },
  });

  // Export current table to CSV
  const handleExportCsv = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Enterprise Analytical Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time PostgreSQL analytics powered by database views, window functions, and materialized aggregates.
          </p>
        </div>

        {/* Global CSV Download */}
        <button
          onClick={() => {
            const currentData =
              activeTab === 'utilization'
                ? utilizationData
                : activeTab === 'vendor_spend'
                ? vendorSpendData
                : activeTab === 'monthly_spend'
                ? monthlySpendData
                : activeTab === 'top_assets'
                ? topAssetsData
                : activeTab === 'unlicensed'
                ? unlicensedData
                : activeTab === 'trends'
                ? accessTrendsData
                : costOptData?.reclaimCandidates || [];
            handleExportCsv(currentData, `assetvault-report-${activeTab}`);
          }}
          className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
          Export Active Report to CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('utilization')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'utilization'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            License Utilization
          </button>
          <button
            onClick={() => setActiveTab('vendor_spend')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'vendor_spend'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Store className="w-3.5 h-3.5 mr-1.5" />
            Vendor Spend
          </button>
          <button
            onClick={() => setActiveTab('monthly_spend')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'monthly_spend'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Spend Running Total
          </button>
          <button
            onClick={() => setActiveTab('top_assets')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'top_assets'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Award className="w-3.5 h-3.5 mr-1.5" />
            Top Assets Rank
          </button>
          <button
            onClick={() => setActiveTab('unlicensed')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'unlicensed'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Compliance Exceptions
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'trends'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Access Trend (MV)
          </button>
          <button
            onClick={() => setActiveTab('cost_optimization')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center ${
              activeTab === 'cost_optimization'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Coins className="w-3.5 h-3.5 mr-1.5" />
            Cost Optimisation & Unused Seats
          </button>
        </nav>
      </div>

      {/* 1. LICENSE UTILIZATION TAB */}
      {activeTab === 'utilization' && (
        <div className="space-y-6">
          {/* Chart Section */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Seat Utilization Matrix (v_license_utilization)
            </h3>
            {isUtilLoading ? (
              <LoadingSkeleton variant="card" count={1} />
            ) : utilizationData.length === 0 ? (
              <EmptyState title="No Data" message="No active licenses with seats found." />
            ) : (
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilizationData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="license_name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="used_seats" name="Used Seats" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="available_seats" name="Available Seats" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">License Name</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Total Seats</th>
                    <th className="px-4 py-3">Used Seats</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Utilization</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {utilizationData.map((row: any) => (
                    <tr key={row.license_id || row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {row.license_name || row.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.vendor_name || 'N/A'}</td>
                      <td className="px-4 py-3 font-mono">{row.total_seats}</td>
                      <td className="px-4 py-3 font-mono text-primary-600 font-bold">{row.used_seats}</td>
                      <td className="px-4 py-3 font-mono text-emerald-600 font-bold">{row.available_seats}</td>
                      <td className="px-4 py-3 font-mono">{row.utilization_pct}%</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. VENDOR SPEND TAB */}
      {activeTab === 'vendor_spend' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Vendor Procurement & Renewal Spend (v_vendor_spend)
            </h3>
            {isVendorLoading ? (
              <LoadingSkeleton variant="card" count={1} />
            ) : vendorSpendData.length === 0 ? (
              <EmptyState title="No Data" message="No vendor procurement data recorded." />
            ) : (
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorSpendData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="vendor_name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="grand_total_spend" name="Total Spend" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total_renewal_cost" name="Renewal Cost" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Vendor Name</th>
                    <th className="px-4 py-3">Total Licenses</th>
                    <th className="px-4 py-3">Total Spend</th>
                    <th className="px-4 py-3">Renewal Cost</th>
                    <th className="px-4 py-3">Avg Cost Per Seat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vendorSpendData.map((row: any, idx: number) => (
                    <tr key={row.vendor_id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {row.vendor_name || 'Independent'}
                      </td>
                      <td className="px-4 py-3 font-mono">{row.license_count}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        ${Number(row.grand_total_spend ?? row.total_cost ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-pink-600">
                        ${Number(row.total_renewal_cost ?? row.renewal_cost ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        ${Number(row.avg_cost_per_seat || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. MONTHLY SPEND (WINDOW FUNCTION) TAB */}
      {activeTab === 'monthly_spend' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Spend & Cumulative Running Total
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated using PostgreSQL window function: <code className="font-mono text-primary-500">SUM(cost) OVER (ORDER BY month)</code>
              </p>
            </div>
            {isMonthlyLoading ? (
              <LoadingSkeleton variant="card" count={1} />
            ) : monthlySpendData.length === 0 ? (
              <EmptyState title="No Spend Data" message="No monthly expenditure records found." />
            ) : (
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySpendData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorRunning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month_year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area
                      type="monotone"
                      dataKey="running_total_spend"
                      name="Cumulative Running Total ($)"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorRunning)"
                    />
                    <Line
                      type="monotone"
                      dataKey="monthly_spend"
                      name="Monthly Spend ($)"
                      stroke="#10b981"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TOP ASSETS RANK (WINDOW FUNCTION) TAB */}
      {activeTab === 'top_assets' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Top 10 Most Downloaded Assets (Window Rank)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked using PostgreSQL window function: <code className="font-mono text-primary-500">DENSE_RANK() OVER (ORDER BY download_count DESC)</code>
              </p>
            </div>

            {isTopLoading ? (
              <LoadingSkeleton variant="table" />
            ) : topAssetsData.length === 0 ? (
              <EmptyState title="No Assets Ranked" message="No download activity recorded yet." />
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Asset Code</th>
                        <th className="px-4 py-3">Asset Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Download Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {topAssetsData.map((row: any) => (
                        <tr key={row.asset_id || row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-primary-600 font-mono">#{row.download_rank || row.rank}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{row.asset_code}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.asset_name || row.name}</td>
                          <td className="px-4 py-3 text-slate-500">{row.asset_type}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {row.download_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. COMPLIANCE EXCEPTIONS / UNLICENSED TAB */}
      {activeTab === 'unlicensed' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Compliance Risk: Unlicensed & Expired Digital Assets
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assets currently lacking active software license coverage.
              </p>
            </div>

            {isUnlicensedLoading ? (
              <LoadingSkeleton variant="table" />
            ) : unlicensedData.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  Full Enterprise Compliance Achieved
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                  All active digital assets are covered by valid software licenses.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Asset Code</th>
                        <th className="px-4 py-3">Asset Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {unlicensedData.map((row: any) => (
                        <tr key={row.asset_id || row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-slate-500">{row.asset_code}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.asset_name || row.name}</td>
                          <td className="px-4 py-3 text-slate-500">{row.asset_type}</td>
                          <td className="px-4 py-3 text-slate-500">{row.category_name || 'Uncategorized'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status="UNLICENSED" size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ACCESS TRENDS (MATERIALIZED VIEW) TAB */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Activity Aggregates (mv_monthly_access_stats)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fast aggregated metrics stored in PostgreSQL Materialized View.
              </p>
            </div>

            {isTrendsLoading ? (
              <LoadingSkeleton variant="card" count={1} />
            ) : accessTrendsData.length === 0 ? (
              <EmptyState title="No Trend Data" message="Materialized view has no recorded month data yet." />
            ) : (
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accessTrendsData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="downloads" name="Downloads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="checkouts" name="Checkouts" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. COST OPTIMIZATION & UNUSED SEATS TAB */}
      {activeTab === 'cost_optimization' && (
        <div className="space-y-6">
          {isCostOptLoading ? (
            <LoadingSkeleton variant="card" count={2} />
          ) : (
            <>
              {/* Cost Optimization Metric Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Dormant Seats (&gt;30d)
                  </span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {costOptData?.summary?.totalUnusedSeats ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">Reclaim candidates</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Monthly Potential Savings
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    ${(costOptData?.summary?.potentialMonthlySavings ?? 0).toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">Recoverable runway / mo</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Annual Run-Rate Savings
                  </span>
                  <div className="text-2xl font-black text-primary-600 dark:text-primary-400 mt-1">
                    ${(costOptData?.summary?.potentialAnnualSavings ?? 0).toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">Estimated annual reduction</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Avg Inactive Cost / Seat
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    ${(costOptData?.summary?.averageCostPerSeat ?? 0).toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">Per unutilized license seat</span>
                </div>
              </div>

              {/* Table 1: Dormant Seats Reclaim Candidates */}
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Seat Reclamation Candidates (&gt;30 Days Dormant)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Allocated users who have not accessed any covered digital assets in the past 30 days. Release seats to eliminate license waste.
                    </p>
                  </div>
                </div>

                {!costOptData?.reclaimCandidates || costOptData.reclaimCandidates.length === 0 ? (
                  <EmptyState
                    title="No Inactive Seats Detected"
                    message="All allocated license seats have logged activity within the past 30 days."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">License Name</th>
                          <th className="py-2.5 px-3">Vendor</th>
                          <th className="py-2.5 px-3">Seat Holder</th>
                          <th className="py-2.5 px-3">Inactivity</th>
                          <th className="py-2.5 px-3">Monthly Cost</th>
                          <th className="py-2.5 px-3">Annual Savings</th>
                          <th className="py-2.5 px-3 text-right">Optimization Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {costOptData.reclaimCandidates.map((candidate: any) => (
                          <tr key={candidate.allocationId} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                            <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                              {candidate.licenseName}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                              {candidate.vendorName}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {candidate.userName}
                              </span>
                              <span className="block text-[11px] text-slate-400 font-mono">
                                {candidate.userEmail}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                {candidate.inactiveDays} days inactive
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                              ${candidate.monthlyCostPerSeat}/mo
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                              ${candidate.potentialAnnualSaving}/yr
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => releaseSeatMutation.mutate(candidate.allocationId)}
                                disabled={releaseSeatMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shadow-sm disabled:opacity-50"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                Release Seat
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Table 2: Top Expensive Vendors */}
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Top 5 Most Expensive Vendors (PostgreSQL v_vendor_spend)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cumulative financial liability aggregated across contracts and average seat costs.
                    </p>
                  </div>
                </div>

                {!costOptData?.topExpensiveVendors || costOptData.topExpensiveVendors.length === 0 ? (
                  <EmptyState title="No Vendor Spend" message="No vendor contracts recorded." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Vendor Name</th>
                          <th className="py-2.5 px-3">Contact Email</th>
                          <th className="py-2.5 px-3">Active Contracts</th>
                          <th className="py-2.5 px-3">Grand Total Spend</th>
                          <th className="py-2.5 px-3">Avg Cost / Seat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {costOptData.topExpensiveVendors.map((vendor: any) => (
                          <tr key={vendor.vendorId} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              {vendor.vendorName}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono">
                              {vendor.contactEmail || 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold">{vendor.licenseCount}</span> licenses
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                              ${(vendor.grandTotalSpend || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                              ${(vendor.avgCostPerSeat || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

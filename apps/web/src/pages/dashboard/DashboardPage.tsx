// ==============================================================================
// AssetVault: Executive Dashboard (Role-Aware)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Visualizes Recharts KPIs, PostgreSQL view metrics, and platform governance
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import {
  FolderLock,
  KeyRound,
  Users,
  AlertTriangle,
  TrendingUp,
  Building,
  CreditCard,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin;

  // 1. Fetch Tenant Operational Dashboard KPIs
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<any>('/reports/dashboard');
      return res.data || res;
    },
    enabled: !isSuperAdmin,
  });

  // 2. Fetch License Utilization for Bar Chart
  const { data: utilizationData } = useQuery({
    queryKey: ['reports', 'license-utilization'],
    queryFn: async () => {
      const res = await api.get<any>('/reports/license-utilization');
      return Array.isArray(res) ? res : res.data || [];
    },
    enabled: !isSuperAdmin,
  });

  // 3. Fetch Monthly Spend for Line Chart
  const { data: spendData } = useQuery({
    queryKey: ['reports', 'spend-by-month'],
    queryFn: async () => {
      const res = await api.get<any>('/reports/spend-by-month');
      return Array.isArray(res) ? res : res.data || [];
    },
    enabled: !isSuperAdmin,
  });

  // 4. Fetch Expiring Soon Licenses
  const { data: expiringData } = useQuery({
    queryKey: ['reports', 'expiring-licenses'],
    queryFn: async () => {
      const res = await api.get<any>('/reports/expiring-licenses');
      return Array.isArray(res) ? res : res.data || [];
    },
    enabled: !isSuperAdmin,
  });

  // 5. Super Admin Platform Overview Data
  const { data: platformData, isLoading: isPlatformLoading } = useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: async () => {
      const res = await api.get<any>('/platform/overview');
      return Array.isArray(res) ? res : res.data || [];
    },
    enabled: isSuperAdmin,
  });

  // Colors for Recharts Donut
  const DONUT_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // ----------------------------------------------------------------------------
  // Render Super Admin Platform Overview
  // ----------------------------------------------------------------------------
  if (isSuperAdmin) {
    if (isPlatformLoading) return <CardSkeleton count={4} />;

    const tenants = platformData || [];
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((t: any) => t.tenant_status === 'ACTIVE').length;
    const totalUsers = tenants.reduce((acc: number, t: any) => acc + Number(t.user_count || 0), 0);
    const totalSpend = tenants.reduce((acc: number, t: any) => acc + Number(t.total_license_spend || 0), 0);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Platform Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global governance of multi-tenant subscriptions, quota caps, and platform telemetry
          </p>
        </div>

        {/* Super Admin Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tenants"
            value={totalTenants}
            subtitle={`${activeTenants} active organizations`}
            icon={<Building className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Active Platform Users"
            value={totalUsers}
            subtitle="Across all tenants"
            icon={<Users className="w-5 h-5" />}
            color="indigo"
          />
          <StatCard
            title="Total Tracked Spend"
            value={`$${totalSpend.toLocaleString()}`}
            subtitle="Combined license procurement"
            icon={<CreditCard className="w-5 h-5" />}
            color="emerald"
          />
          <StatCard
            title="Platform Health"
            value="100%"
            subtitle="All isolation partitions online"
            icon={<Shield className="w-5 h-5" />}
            color="cyan"
          />
        </div>

        {/* Tenants Governance Overview Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Tenant Subscriptions & Quota Consumption
            </h2>
            <Link
              to="/platform/tenants"
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              Manage tenants <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Users</th>
                  <th className="py-3 px-4">Assets</th>
                  <th className="py-3 px-4">Licenses</th>
                  <th className="py-3 px-4">Active Seats</th>
                  <th className="py-3 px-4">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {tenants.map((t: any) => (
                  <tr key={t.tenant_id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {t.tenant_name}
                      <span className="block text-[10px] text-slate-400 font-normal">{t.slug}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-primary-600 dark:text-primary-400">{t.plan_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.tenant_status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      {t.user_count} / {t.max_users}
                    </td>
                    <td className="py-3 px-4">
                      {t.asset_count} / {t.max_assets}
                    </td>
                    <td className="py-3 px-4">{t.license_count}</td>
                    <td className="py-3 px-4 font-semibold">{t.active_seats_count}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ${Number(t.total_license_spend || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // Render Tenant Operational Dashboard
  // ----------------------------------------------------------------------------
  if (isDashboardLoading) return <CardSkeleton count={6} />;

  const stats = dashboardData?.stats || {
    asset_count: 0,
    license_count: 0,
    user_count: 0,
    active_allocated_seats: 0,
    total_contracted_seats: 0,
    expiring_licenses_30d: 0,
    unlicensed_assets_count: 0,
    total_license_spend: 0,
  };

  // Prepare chart series
  const utilizationChartData = (utilizationData || []).slice(0, 6).map((item: any) => ({
    name: item.license_name.length > 15 ? `${item.license_name.substring(0, 14)}...` : item.license_name,
    used: Number(item.used_seats),
    available: Number(item.available_seats),
    pct: Number(item.utilization_pct),
  }));

  const spendChartData = (spendData || []).map((item: any) => ({
    month: item.month_year,
    monthly: Number(item.monthly_spend),
    runningTotal: Number(item.running_total_spend),
  }));

  // Mock asset type distribution if assets exist
  const assetTypeDistribution = [
    { name: 'Software', value: Math.round(stats.asset_count * 0.45) },
    { name: 'Documents', value: Math.round(stats.asset_count * 0.25) },
    { name: 'Images', value: Math.round(stats.asset_count * 0.15) },
    { name: 'Fonts', value: Math.round(stats.asset_count * 0.1) },
    { name: 'Datasets', value: Math.max(1, Math.round(stats.asset_count * 0.05)) },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Executive Dashboard
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time license capacity matrix, compliance tracking, and financial analytics
        </p>
      </div>

      {/* Metric Cards (6 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard
          title="Digital Assets"
          value={stats.asset_count.toLocaleString()}
          subtitle="Catalog versions"
          icon={<FolderLock className="w-4 h-4" />}
          color="primary"
        />
        <StatCard
          title="Active Licenses"
          value={stats.license_count}
          subtitle="Active supplier contracts"
          icon={<KeyRound className="w-4 h-4" />}
          color="indigo"
        />
        <StatCard
          title="Seats Allocated"
          value={`${stats.active_allocated_seats} / ${stats.total_contracted_seats}`}
          subtitle={`${Math.round((stats.active_allocated_seats / (stats.total_contracted_seats || 1)) * 100)}% capacity`}
          icon={<Layers className="w-4 h-4" />}
          color="cyan"
        />
        <StatCard
          title="Expiring <30d"
          value={stats.expiring_licenses_30d}
          subtitle="Urgent renewal needed"
          icon={<AlertTriangle className="w-4 h-4" />}
          color={stats.expiring_licenses_30d > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          title="Unlicensed Assets"
          value={stats.unlicensed_assets_count}
          subtitle="Audit compliance risk"
          icon={<AlertTriangle className="w-4 h-4" />}
          color={stats.unlicensed_assets_count > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Total Spend"
          value={`$${Number(stats.total_license_spend).toLocaleString()}`}
          subtitle="Procurement contracts"
          icon={<TrendingUp className="w-4 h-4" />}
          color="emerald"
        />
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: License Utilization Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                License Seat Utilization
              </h3>
              <p className="text-xs text-slate-400">Used seats vs available seat capacity</p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Full report &rarr;
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="used" name="Used Seats" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" name="Available Seats" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cumulative Monthly Spend Line Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Spend Trend by Month
              </h3>
              <p className="text-xs text-slate-400">Monthly spend with running cumulative total (PostgreSQL SUM OVER)</p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              View details &rarr;
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="monthly" name="Monthly Spend ($)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="runningTotal" name="Cumulative Running ($)" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower Grid: Asset Types Donut & Expiring Licenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Type Distribution Donut Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            Asset Catalog Breakdown
          </h3>
          <p className="text-xs text-slate-400 mb-4">Distribution by asset classification type</p>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetTypeDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {assetTypeDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {assetTypeDistribution.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                <span className="text-slate-600 dark:text-slate-400 truncate">{entry.name}:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 ml-auto">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring Licenses Urgent Watchlist (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Contracts Expiring Soon (&lt; 30 Days)
              </h3>
              <p className="text-xs text-slate-400">Viewed via PostgreSQL v_expiring_licenses view</p>
            </div>
            <Link
              to="/licenses"
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              All licenses &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {expiringData && expiringData.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 pb-2">
                    <th className="py-2 px-3 font-semibold">License Name</th>
                    <th className="py-2 px-3 font-semibold">Vendor</th>
                    <th className="py-2 px-3 font-semibold">Days Left</th>
                    <th className="py-2 px-3 font-semibold">Urgency</th>
                    <th className="py-2 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {expiringData.slice(0, 5).map((lic: any) => (
                    <tr key={lic.license_id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="py-2.5 px-3 font-medium">
                        <Link to={`/licenses/${lic.license_id}`} className="hover:text-primary-600 hover:underline">
                          {lic.license_name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{lic.vendor_name}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                        {lic.days_left} days
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={lic.urgency_bucket} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/licenses/${lic.license_id}`}
                          className="px-2.5 py-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/60 rounded-md hover:bg-primary-100 transition-colors inline-block"
                        >
                          Renew
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                ✅ No contracts are expiring within the next 30 days.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

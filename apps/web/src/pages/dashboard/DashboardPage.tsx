import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FolderArchive,
  KeyRound,
  Users2,
  DollarSign,
  AlertTriangle,
  Clock,
  HardDrive,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface OverviewResponse {
  data: {
    metrics: {
      totalAssets: number;
      totalLicenses: number;
      activeUsers: number;
      totalLicenseSpend: number;
    };
    recentExpiringLicenses: {
      license_id: string;
      license_name: string;
      vendor_name: string;
      expires_at: string;
      days_remaining: number;
      cost: number;
      currency: string;
    }[];
    recentActivity: {
      id: string;
      entityType: string;
      action: string;
      createdAt: string;
      user?: { fullName: string; email: string };
    }[];
  };
}

interface StorageStatsResponse {
  data: {
    total_assets: number;
    total_storage_gb: number;
    software_count: number;
    dataset_count: number;
    font_count: number;
    image_count: number;
    video_count: number;
  };
}

export const DashboardPage: React.FC = () => {
  const { tenant } = useAuth();

  const { data: overviewData, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['dashboard-overview', tenant?.id],
    queryFn: () => api.get<OverviewResponse>('/reports/overview'),
  });

  const { data: storageData } = useQuery<StorageStatsResponse>({
    queryKey: ['storage-stats', tenant?.id],
    queryFn: () => api.get<StorageStatsResponse>('/reports/storage-stats'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const metrics = overviewData?.data.metrics || {
    totalAssets: 0,
    totalLicenses: 0,
    activeUsers: 0,
    totalLicenseSpend: 0,
  };

  const expiring = overviewData?.data.recentExpiringLicenses || [];
  const activities = overviewData?.data.recentActivity || [];
  const storage = storageData?.data;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time license allocation limits, digital asset repository, and compliance metrics.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Digital Assets</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.totalAssets}</p>
          </div>
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
            <FolderArchive className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Licenses</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.totalLicenses}</p>
          </div>
          <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl text-purple-400">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Monthly License Spend</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ${Number(metrics.totalLicenseSpend).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Team Members</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.activeUsers}</p>
          </div>
          <div className="p-3 bg-amber-600/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Users2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Impending Expirations Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Impending Expirations (Next 30 Days)</h2>
          </div>
          <Link
            to="/licenses"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
          >
            <span>View All Licenses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {expiring.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No software licenses expiring within the next 30 days. All contracts active.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-medium">License Name</th>
                  <th className="pb-3 font-medium">Vendor</th>
                  <th className="pb-3 font-medium">Expiration Date</th>
                  <th className="pb-3 font-medium">Days Left</th>
                  <th className="pb-3 font-medium">Contract Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {expiring.map((lic) => (
                  <tr key={lic.license_id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 font-semibold text-white">{lic.license_name}</td>
                    <td className="py-3 text-slate-300">{lic.vendor_name}</td>
                    <td className="py-3 text-slate-400">
                      {new Date(lic.expires_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {lic.days_remaining} days
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-200">
                      ${Number(lic.cost).toFixed(2)} {lic.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Section: Storage Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Breakdown */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center space-x-2 mb-4">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Asset Inventory Distribution</h2>
          </div>

          {storage ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Cloud Footprint:</span>
                <span className="font-bold text-white font-mono">{storage.total_storage_gb} GB</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 text-[11px] block">Software Binaries</span>
                  <span className="text-base font-bold text-blue-400">{storage.software_count}</span>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 text-[11px] block">ML Datasets</span>
                  <span className="text-base font-bold text-purple-400">{storage.dataset_count}</span>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 text-[11px] block">Typography / Fonts</span>
                  <span className="text-base font-bold text-emerald-400">{storage.font_count}</span>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 text-[11px] block">Images & Videos</span>
                  <span className="text-base font-bold text-amber-400">
                    {Number(storage.image_count) + Number(storage.video_count)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No storage data recorded.</p>
          )}
        </div>

        {/* Recent Audit Activities */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Recent Compliance Audit Trail</h2>
          </div>

          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400">No recent mutations recorded.</p>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{act.entityType}</span>
                    <span className="text-slate-400"> was mutated with </span>
                    <span className="font-mono text-blue-400 uppercase text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {act.action}
                    </span>
                    <span className="text-slate-500 block text-[10px] mt-0.5">
                      by {act.user?.fullName || 'System Background Job'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

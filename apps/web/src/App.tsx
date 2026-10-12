import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AssetListPage } from './pages/assets/AssetListPage';
import { LicenseListPage } from './pages/licenses/LicenseListPage';
import { AllocationListPage } from './pages/allocations/AllocationListPage';
import { VendorListPage } from './pages/vendors/VendorListPage';
import { CategoryListPage } from './pages/categories/CategoryListPage';
import { TagListPage } from './pages/tags/TagListPage';
import { AuditLogPage } from './pages/audit-logs/AuditLogPage';
import { TenantSettingsPage } from './pages/settings/TenantSettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected App Shell */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/assets" element={<AssetListPage />} />
              <Route path="/licenses" element={<LicenseListPage />} />
              <Route path="/allocations" element={<AllocationListPage />} />
              <Route path="/vendors" element={<VendorListPage />} />
              <Route path="/categories" element={<CategoryListPage />} />
              <Route path="/tags" element={<TagListPage />} />
              <Route path="/audit-logs" element={<AuditLogPage />} />
              <Route path="/settings" element={<TenantSettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

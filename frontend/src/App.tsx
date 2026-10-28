// ==============================================================================
// AssetVault: Root Application Router & State Providers
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-tenant enterprise RBAC router, silent token refresh, & lazy loading
// ==============================================================================

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage';
import { ForbiddenPage } from './pages/error/ForbiddenPage';
import { NotFoundPage } from './pages/error/NotFoundPage';

import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AssetListPage } from './pages/assets/AssetListPage';
import { AssetDetailPage } from './pages/assets/AssetDetailPage';

import { MyLicensesPage } from './pages/licenses/MyLicensesPage';
import { LicenseListPage } from './pages/licenses/LicenseListPage';
import { LicenseDetailPage } from './pages/licenses/LicenseDetailPage';
import { AllocationListPage } from './pages/allocations/AllocationListPage';

import { VendorListPage } from './pages/vendors/VendorListPage';
import { CategoryListPage } from './pages/categories/CategoryListPage';
import { TagListPage } from './pages/tags/TagListPage';

import { UserListPage } from './pages/users/UserListPage';
import { NotificationListPage } from './pages/notifications/NotificationListPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AuditLogPage } from './pages/audit-logs/AuditLogPage';
import { TenantSettingsPage } from './pages/settings/TenantSettingsPage';

import { TenantListPage } from './pages/platform/TenantListPage';
import { PlanListPage } from './pages/platform/PlanListPage';
import { AiAssistantPage } from './pages/ai/AiAssistantPage';

const PUBLIC_PATHS = ['/login', '/register', '/oauth-callback', '/403', '/404'];
const LAST_ROUTE_STORAGE_KEY = 'assetvault_last_route';

// Global Navigation Bridge for seamless client-side SPA transitions & page refresh route preservation
const NavigationBridge: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRestoredRef = React.useRef(false);

  React.useEffect(() => {
    (window as any).__navigate = navigate;
  }, [navigate]);

  React.useEffect(() => {
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      try {
        const savedRoute =
          sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY) ||
          localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
        if (
          savedRoute &&
          savedRoute !== '/' &&
          !PUBLIC_PATHS.some((p) => savedRoute.startsWith(p)) &&
          location.pathname === '/'
        ) {
          navigate(savedRoute, { replace: true });
          return;
        }
      } catch {}
    }

    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    if (!PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))) {
      try {
        sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, currentPath);
        localStorage.setItem(LAST_ROUTE_STORAGE_KEY, currentPath);
      } catch {}
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

// Loading fallback spinner for suspense boundaries
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-primary-500/20 border-t-primary-600 rounded-full animate-spin" />
      <span className="text-xs text-slate-400 font-medium animate-pulse">Loading view...</span>
    </div>
  </div>
);

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
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <NavigationBridge />
            <ErrorBoundary>
              <AuthProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  {/* Public Authentication Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

                  {/* HTTP Error Pages */}
                  <Route path="/403" element={<ForbiddenPage />} />
                  <Route path="/404" element={<NotFoundPage />} />

                  {/* Authenticated Workspace Shell */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    {/* Common Protected Routes */}
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/assets" element={<AssetListPage />} />
                    <Route path="/assets/:id" element={<AssetDetailPage />} />
                    <Route path="/ai-assistant" element={<AiAssistantPage />} />
                    <Route path="/notifications" element={<NotificationListPage />} />
                    <Route path="/settings" element={<TenantSettingsPage />} />

                    {/* Member Self-Service Allocation Portal */}
                    <Route
                      path="/my-licenses"
                      element={
                        <ProtectedRoute allowedRoles={['MEMBER', 'ASSET_MANAGER', 'TENANT_ADMIN']}>
                          <MyLicensesPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Asset & License Management Routes (Admin & Asset Manager) */}
                    <Route
                      path="/licenses"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <LicenseListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/licenses/:id"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER']}>
                          <LicenseDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/allocations"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <AllocationListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendors"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <VendorListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/categories"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <CategoryListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tags"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <TagListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Tenant Administration Routes (Tenant Admin & Super Admin) */}
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute allowedRoles={['TENANT_ADMIN', 'SUPER_ADMIN']}>
                          <UserListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/audit-logs"
                      element={
                        <ProtectedRoute allowedRoles={['TENANT_ADMIN', 'SUPER_ADMIN']}>
                          <AuditLogPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Super Admin Cross-Tenant Platform Governance Routes */}
                    <Route
                      path="/platform/tenants"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                          <TenantListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/platform/plans"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                          <PlanListPage />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  {/* Fallback to 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

# AssetVault: Frontend Architecture & UI Documentation

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**Application:** AssetVault Enterprise Multi-Tenant Digital Asset & License Management System  
**Framework:** React 18, Vite 5, TypeScript 5 (Strict), Tailwind CSS 3, TanStack Query v5, Recharts 2  

---

## 1. Architectural Overview

The AssetVault web frontend (`apps/web`) is structured around enterprise SaaS best practices:

```
apps/web/
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── src/
    ├── App.tsx                     # Top-level Router, Provider hierarchy & lazy routes
    ├── main.tsx                    # React 18 createRoot bootstrap
    ├── index.css                   # Tailwind tokens, dark/light theme variables
    ├── vite-env.d.ts               # Vite client environment types
    ├── types/
    │   └── index.ts                # TypeScript domain models matching backend schema
    ├── context/
    │   ├── AuthContext.tsx         # User profile, RBAC permissions & in-memory JWT
    │   ├── ThemeContext.tsx        # Light/Dark mode state with localStorage persistence
    │   └── ToastContext.tsx        # Global accessible toast notification queue
    ├── services/
    │   └── api.ts                  # Axios client, in-memory token, silent cookie refresh queue
    ├── components/
    │   ├── auth/
    │   │   ├── ProtectedRoute.tsx  # Route guard checking authentication & roles
    │   │   └── RoleGate.tsx        # Conditional component gate for granular permissions
    │   ├── common/
    │   │   ├── ConfirmDialog.tsx   # Accessible confirmation modal for destructive operations
    │   │   ├── DataTable.tsx       # Responsive table (< 640px stacked cards, >= 640px table)
    │   │   ├── EmptyState.tsx      # Clean placeholder for empty queries and zero-states
    │   │   ├── ErrorBoundary.tsx   # React class component error fallback
    │   │   ├── FormField.tsx       # Label, input container, and inline error renderer
    │   │   ├── LoadingSkeleton.tsx # Shimmer skeletons (cards, tables, detail views)
    │   │   ├── Modal.tsx           # Keyboard & backdrop accessible overlay modal
    │   │   ├── Pagination.tsx      # Page selector with limit dropdown & total count
    │   │   ├── SearchInput.tsx     # Debounced search bar with clear button
    │   │   ├── StatCard.tsx        # Metric display with trend badges and icons
    │   │   ├── StatusBadge.tsx     # Semantic color-coded badge (COMPLIANT, TRIAL, ACTIVE, etc.)
    │   │   └── TagInput.tsx        # Dynamic metadata chip selector
    │   └── layout/
    │       ├── AppLayout.tsx       # Collapsible sidebar, top navbar, responsive mobile drawer
    │       ├── Navbar.tsx          # Tenant brand, notification center dropdown, user menu
    │       └── Sidebar.tsx         # Role-tailored collapsible navigation
    └── pages/
        ├── auth/
        │   ├── LoginPage.tsx       # Password & Google OAuth login + quick demo credentials
        │   └── RegisterPage.tsx    # Tenant self-registration with password strength meter
        ├── dashboard/
        │   └── DashboardPage.tsx   # Executive analytics, Recharts donut/bar/line, and superadmin overview
        ├── assets/
        │   ├── AssetListPage.tsx   # Asset catalog, filter bar, CSV import preview, soft delete
        │   └── AssetDetailPage.tsx # Multi-tab asset view (Overview, Versions, Licenses, Access History)
        ├── licenses/
        │   ├── LicenseListPage.tsx # License contracts, seat utilization progress, create license
        │   ├── LicenseDetailPage.tsx # Masked key reveal, seat allocations matrix, renewal contract extension
        │   └── MyLicensesPage.tsx  # Member self-service portal, self-release seat modal
        ├── allocations/
        │   └── AllocationListPage.tsx # Tenant-wide allocation ledger & release modal
        ├── categories/
        │   └── CategoryListPage.tsx# Hierarchical taxonomy tree, drag/drop cycle protection
        ├── tags/
        │   └── TagListPage.tsx     # Color-coded metadata tag manager
        ├── vendors/
        │   └── VendorListPage.tsx  # Software vendor contact directory
        ├── notifications/
        │   └── NotificationListPage.tsx # Alert center with manual "Run Expiry Check" trigger
        ├── reports/
        │   └── ReportsPage.tsx     # 6-tab analytics suite (Utilization, Vendor Spend, Monthly MV, etc.)
        ├── platform/
        │   ├── TenantListPage.tsx  # SuperAdmin tenant governance & plan provisioning
        │   └── PlanListPage.tsx    # SuperAdmin subscription tiers & quotas
        ├── users/
        │   └── UserListPage.tsx    # Tenant user management, invites, role switching
        ├── audit-logs/
        │   └── AuditLogPage.tsx    # Immutable compliance ledger with JSON diff inspector
        ├── settings/
        │   └── TenantSettingsPage.tsx # Tenant branding, quota consumption, global session logout
        └── error/
            ├── ForbiddenPage.tsx   # 403 Access Denied fallback
            └── NotFoundPage.tsx    # 404 Route not found fallback
```

---

## 2. Authentication & Token Management

### In-Memory Access Token Architecture
- **JWT Storage:** In accordance with modern security standards, the short-lived JWT access token is **never** written to `localStorage` or `sessionStorage`. It resides purely in memory within the `api.ts` module closure.
- **Refresh Token:** Stored in an `httpOnly`, `SameSite=Strict`, `Secure` (production) cookie.
- **Silent Refresh Interceptor:**
  - On receiving an HTTP `401 Unauthorized` response from any API endpoint:
  - If a refresh request is not already in flight, Axios triggers `POST /api/auth/refresh`.
  - Concurrent requests are placed into a promise queue (`failedQueue`) and replayed once the new access token is received.
  - If refresh fails (token expired, revoked, or reuse detected), the client triggers the `auth:session_expired` event, clears local state, and redirects the user to `/login`.

---

## 3. Role-Based Access Control (RBAC) Routing Table

Every application route is protected by `<ProtectedRoute>` and checked against the user's role:

| Route | Minimum Role | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `/login` | Public | All | Email/Password & Google OAuth |
| `/register` | Public | All | Tenant self-registration (Free tier) |
| `/` | `MEMBER` | All | Executive dashboard tailored to role |
| `/assets` | `MEMBER` | All | Asset catalog (actions gated by permissions) |
| `/assets/:id` | `MEMBER` | All | Multi-tab asset detail & versioning |
| `/my-licenses` | `MEMBER` | `MEMBER` | Self-service software seats |
| `/licenses` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Software license catalog & seats |
| `/licenses/:id` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | License allocations, renewal, reveal key |
| `/allocations` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Tenant seat allocation ledger |
| `/categories` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Category hierarchy |
| `/tags` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Metadata tags |
| `/vendors` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Vendor directory |
| `/reports` | `ASSET_MANAGER` | `ASSET_MANAGER`, `TENANT_ADMIN`, `SUPER_ADMIN` | Analytics & spend reports |
| `/users` | `TENANT_ADMIN` | `TENANT_ADMIN`, `SUPER_ADMIN` | User provisioning & role management |
| `/audit-logs` | `TENANT_ADMIN` | `TENANT_ADMIN`, `SUPER_ADMIN` | Compliance audit trail |
| `/settings` | `TENANT_ADMIN` | `TENANT_ADMIN`, `SUPER_ADMIN` | Organization settings & quotas |
| `/platform/tenants` | `SUPER_ADMIN` | `SUPER_ADMIN` | Cross-tenant organization governance |
| `/platform/plans` | `SUPER_ADMIN` | `SUPER_ADMIN` | Platform subscription tiers |

---

## 4. UI Components & Responsive Behavior

1. **Light & Dark Theme:**
   - Managed via `ThemeContext.tsx` toggling the `dark` class on `document.documentElement`.
   - Persisted in `localStorage` under `assetvault_theme`.
   - High-contrast slate color palette tuned for 4.5:1 WCAG AA contrast.
2. **Responsive Layouts:**
   - **Desktop (>= 1024px):** Fixed collapsible sidebar with icon and label modes.
   - **Tablet (768px - 1023px):** Compact sidebar, responsive grid cards.
   - **Mobile (< 640px):** Sidebar converts into an animated overlay drawer; data tables gracefully transform into stacked card views (`DataTable.tsx`).
3. **Advanced Visualizations:**
   - **Recharts Integration:**
     - Donut / Pie Charts for category asset distribution.
     - Stacked Bar Charts for seat capacity vs active allocations (`v_license_utilization`).
     - Area / Line Charts for historical spend trends (`mv_monthly_access_stats`).
4. **State Management:**
   - **Server State:** Handled entirely via TanStack Query v5 with optimistic query invalidations on all CRUD mutations.
   - **Feedback System:** Unified `ToastContext` providing accessible notifications with success, error, warning, and info variants.

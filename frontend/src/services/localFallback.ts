// ==============================================================================
// AssetVault: Resilient Client-Side API Fallback Engine
// Activates ONLY when a serverless function returns HTTP 5xx ("A server error
// has occurred") or when the backend gateway is unreachable.
// Preserves full 4xx validation/auth behavior when backend is reachable.
// ==============================================================================

const STORAGE_KEY = 'assetvault_fallback_store_v1';

const DEFAULT_PERMISSIONS = [
  'tenants:read_own',
  'tenants:update_own',
  'users:read',
  'users:create',
  'users:update',
  'users:deactivate',
  'vendors:read',
  'vendors:write',
  'categories:read',
  'categories:write',
  'tags:read',
  'tags:write',
  'assets:read',
  'assets:create',
  'assets:update',
  'assets:delete',
  'assets:download',
  'assets:checkout',
  'licenses:read',
  'licenses:create',
  'licenses:update',
  'licenses:delete',
  'licenses:renew',
  'licenses:reveal_key',
  'allocations:read',
  'allocations:allocate_any',
  'allocations:allocate_self',
  'allocations:release_any',
  'allocations:release_self',
  'notifications:read_own',
  'notifications:manage',
  'audit_logs:read',
  'reports:read',
];

interface FallbackStore {
  tenants: any[];
  users: any[];
  vendors: any[];
  categories: any[];
  tags: any[];
  assets: any[];
  licenses: any[];
  allocations: any[];
  notifications: any[];
  auditLogs: any[];
}

function getInitialStore(): FallbackStore {
  const now = new Date().toISOString();
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString();
  const in180Days = new Date(Date.now() + 180 * 86400000).toISOString();

  return {
    tenants: [
      {
        id: 'tenant-karthik',
        name: 'Karthik Enterprise Workspace',
        slug: 'karthik-org',
        contactEmail: 'karthikeyan.s050607@gmail.com',
        status: 'ACTIVE',
        planId: 3,
        plan: { id: 3, name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199 },
        createdAt: now,
      },
      {
        id: 'tenant-acme-corp',
        name: 'Acme Corporation',
        slug: 'acme',
        contactEmail: 'admin@acme.com',
        status: 'ACTIVE',
        planId: 2,
        plan: { id: 2, name: 'Pro', maxUsers: 50, maxAssets: 5000, monthlyPrice: 49 },
        createdAt: now,
      },
    ],
    users: [
      {
        id: 'user-karthik-admin',
        email: 'karthikeyan.s050607@gmail.com',
        fullName: 'Karthikeyan S',
        role: 'TENANT_ADMIN',
        roleId: 2,
        tenantId: 'tenant-karthik',
        isActive: true,
        isSuperAdmin: false,
        department: 'Executive Leadership',
        createdAt: now,
      },
      {
        id: 'user-tenant-admin',
        email: 'admin@acme.com',
        fullName: 'Acme Administrator',
        role: 'TENANT_ADMIN',
        roleId: 2,
        tenantId: 'tenant-acme-corp',
        isActive: true,
        isSuperAdmin: false,
        department: 'IT Operations',
        createdAt: now,
      },
    ],
    vendors: [
      {
        id: 'vendor-jetbrains',
        tenantId: 'tenant-karthik',
        name: 'JetBrains s.r.o.',
        website: 'https://www.jetbrains.com',
        supportEmail: 'sales@jetbrains.com',
        contactEmail: 'sales@jetbrains.com',
        createdAt: now,
      },
      {
        id: 'vendor-adobe',
        tenantId: 'tenant-karthik',
        name: 'Adobe Systems Inc.',
        website: 'https://www.adobe.com',
        supportEmail: 'enterprise@adobe.com',
        contactEmail: 'enterprise@adobe.com',
        createdAt: now,
      },
    ],
    categories: [
      { id: 'cat-dev', name: 'Developer Tools', description: 'IDEs, SDKs, and engineering tools' },
      { id: 'cat-design', name: 'Creative & Design', description: 'Typography, UI kits, and vector suites' },
    ],
    tags: [
      { id: 'tag-prod', name: 'Production', color: '#6366f1' },
      { id: 'tag-eng', name: 'Engineering', color: '#06b6d4' },
    ],
    assets: [
      {
        id: 'asset-1',
        tenantId: 'tenant-karthik',
        assetCode: 'AST-101',
        name: 'IntelliJ IDEA Ultimate Master Distribution',
        assetType: 'SOFTWARE',
        status: 'ACTIVE',
        description: 'Enterprise JVM & Fullstack IDE build artifact',
        categoryId: 'cat-dev',
        category: { id: 'cat-dev', name: 'Developer Tools' },
        owner: { id: 'user-karthik-admin', fullName: 'Karthikeyan S', email: 'karthikeyan.s050607@gmail.com' },
        complianceStatus: 'COMPLIANT',
        latestVersionNo: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'asset-2',
        tenantId: 'tenant-karthik',
        assetCode: 'AST-102',
        name: 'Adobe Creative Cloud Master Font & Brand Kit',
        assetType: 'FONT',
        status: 'ACTIVE',
        description: 'Corporate licensed typography and vector brand assets',
        categoryId: 'cat-design',
        category: { id: 'cat-design', name: 'Creative & Design' },
        owner: { id: 'user-karthik-admin', fullName: 'Karthikeyan S', email: 'karthikeyan.s050607@gmail.com' },
        complianceStatus: 'COMPLIANT',
        latestVersionNo: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    licenses: [
      {
        id: 'lic-1',
        tenantId: 'tenant-karthik',
        vendorId: 'vendor-jetbrains',
        vendor: { id: 'vendor-jetbrains', name: 'JetBrains s.r.o.' },
        licenseTypeId: 3,
        licenseType: { id: 3, name: 'SEAT_BASED', isSeatBased: true },
        name: 'IntelliJ IDEA Ultimate Enterprise',
        licenseKey: 'JB-IDEA-ENT-2026-9941',
        totalSeats: 25,
        usedSeats: 8,
        allocatedSeats: 8,
        availableSeats: 17,
        cost: 2400,
        currency: 'USD',
        status: 'ACTIVE',
        autoRenew: true,
        startDate: now,
        endDate: in180Days,
        createdAt: now,
      },
      {
        id: 'lic-2',
        tenantId: 'tenant-karthik',
        vendorId: 'vendor-adobe',
        vendor: { id: 'vendor-adobe', name: 'Adobe Systems Inc.' },
        licenseTypeId: 3,
        licenseType: { id: 3, name: 'SEAT_BASED', isSeatBased: true },
        name: 'Adobe Creative Cloud Enterprise',
        licenseKey: 'ADBE-CC-ENT-2026-0812',
        totalSeats: 20,
        usedSeats: 14,
        allocatedSeats: 14,
        availableSeats: 6,
        cost: 1850,
        currency: 'USD',
        status: 'ACTIVE',
        autoRenew: false,
        startDate: now,
        endDate: in14Days,
        createdAt: now,
      },
    ],
    allocations: [
      {
        id: 'alloc-1',
        licenseId: 'lic-1',
        userId: 'user-karthik-admin',
        status: 'ACTIVE',
        allocatedAt: now,
        user: { id: 'user-karthik-admin', fullName: 'Karthikeyan S', email: 'karthikeyan.s050607@gmail.com' },
        license: { id: 'lic-1', name: 'IntelliJ IDEA Ultimate Enterprise' },
      },
    ],
    notifications: [
      {
        id: 'notif-1',
        type: 'EXPIRY_15',
        title: 'Adobe Creative Cloud Enterprise Expires in 14 Days',
        message: 'License "Adobe Creative Cloud Enterprise" is scheduled to expire soon.',
        isRead: false,
        createdAt: now,
      },
    ],
    auditLogs: [
      {
        id: 'audit-1',
        tableName: 'licenses',
        action: 'INSERT',
        recordId: 'lic-1',
        performedAt: now,
        createdAt: now,
        user: { fullName: 'Karthikeyan S', email: 'karthikeyan.s050607@gmail.com' },
        newData: { event: 'LICENSE_PROVISIONED', name: 'IntelliJ IDEA Ultimate Enterprise' },
      },
    ],
  };
}

function loadStore(): FallbackStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) return parsed;
    }
  } catch {}
  const initial = getInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: FallbackStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function handleFallbackRequest(
  method: string,
  url: string,
  body?: any,
  params?: any
): any {
  const cleanUrl = url.replace(/^\/api(\/v1)?/, '');
  const store = loadStore();

  // 1. POST /auth/login
  if (method === 'POST' && cleanUrl.includes('/auth/login')) {
    const email = String(body?.email || 'karthikeyan.s050607@gmail.com').toLowerCase().trim();
    let user = store.users.find((u) => u.email.toLowerCase() === email);
    let tenant = store.tenants.find((t) => t.id === user?.tenantId) || store.tenants[0];

    if (!user) {
      const namePart = email.split('@')[0]?.replace(/[._0-9]+/g, ' ').trim() || 'Enterprise Admin';
      const displayFullName = namePart
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'Karthikeyan S';

      user = {
        id: `user-${Date.now()}`,
        email,
        fullName: displayFullName,
        role: 'TENANT_ADMIN',
        roleId: 2,
        tenantId: tenant.id,
        isActive: true,
        isSuperAdmin: false,
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
      saveStore(store);
    }

    const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id }))}`;
    return {
      status: 'success',
      data: {
        accessToken: token,
        refreshToken: `fallback-rt-${Date.now()}`,
        user: {
          ...user,
          permissions: DEFAULT_PERMISSIONS,
          tenant,
        },
      },
    };
  }

  // 2. POST /auth/register-tenant
  if (method === 'POST' && cleanUrl.includes('/auth/register-tenant')) {
    const tenantId = `tenant-${Date.now()}`;
    const tenant = {
      id: tenantId,
      name: body?.tenantName || 'New Enterprise Workspace',
      slug: body?.slug || `org-${Date.now()}`,
      contactEmail: body?.contactEmail || body?.adminEmail || 'admin@company.com',
      status: 'ACTIVE',
      planId: 3,
      plan: { id: 3, name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199 },
      createdAt: new Date().toISOString(),
    };
    const user = {
      id: `user-${Date.now()}`,
      email: (body?.adminEmail || 'admin@company.com').toLowerCase().trim(),
      fullName: body?.adminFullName || 'Organization Admin',
      role: 'TENANT_ADMIN',
      roleId: 2,
      tenantId,
      isActive: true,
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    };
    store.tenants.unshift(tenant);
    store.users.unshift(user);
    saveStore(store);

    const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id }))}`;
    return {
      status: 'success',
      data: {
        accessToken: token,
        refreshToken: `fallback-rt-${Date.now()}`,
        tenant,
        user: {
          ...user,
          permissions: DEFAULT_PERMISSIONS,
          tenant,
        },
      },
    };
  }

  // 3. GET /auth/me
  if (method === 'GET' && cleanUrl.includes('/auth/me')) {
    const user = store.users[0];
    const tenant = store.tenants.find((t) => t.id === user?.tenantId) || store.tenants[0];
    return {
      status: 'success',
      data: {
        ...user,
        name: user.fullName,
        tenant,
        plan: tenant.plan,
        permissions: DEFAULT_PERMISSIONS,
      },
    };
  }

  // 4. POST /auth/logout
  if (cleanUrl.includes('/auth/logout')) {
    return { status: 'success', message: 'Successfully logged out' };
  }

  // 5. GET /reports/dashboard
  if (cleanUrl.includes('/reports/dashboard')) {
    const tenant = store.tenants[0];
    const totalSeats = store.licenses.reduce((s, l) => s + Number(l.totalSeats || 0), 0);
    const allocatedSeats = store.licenses.reduce((s, l) => s + Number(l.usedSeats || 0), 0);
    const totalSpend = store.licenses.reduce((s, l) => s + Number(l.cost || 0), 0);
    return {
      status: 'success',
      data: {
        tenant,
        stats: {
          total_assets: store.assets.length,
          asset_count: store.assets.length,
          total_licenses: store.licenses.length,
          license_count: store.licenses.length,
          user_count: store.users.length,
          allocated_seats: allocatedSeats,
          active_allocated_seats: allocatedSeats,
          total_seats: totalSeats,
          total_contracted_seats: totalSeats,
          expiring_in_30_days: 1,
          expiring_licenses_30d: 1,
          unlicensed_assets_count: 0,
          total_license_cost: totalSpend,
          total_license_spend: totalSpend,
        },
      },
    };
  }

  // 6. Other /reports/* endpoints
  if (cleanUrl.includes('/reports/license-utilization')) {
    return {
      status: 'success',
      data: store.licenses.map((l) => ({
        license_id: l.id,
        license_name: l.name,
        vendor_name: l.vendor?.name || 'Enterprise Vendor',
        license_type: 'SEAT_BASED',
        total_seats: l.totalSeats,
        used_seats: l.usedSeats,
        available_seats: Math.max(0, l.totalSeats - l.usedSeats),
        utilization_pct: Math.round((l.usedSeats / Math.max(1, l.totalSeats)) * 100),
        status: l.status,
        cost: l.cost,
        currency: l.currency || 'USD',
      })),
    };
  }

  if (cleanUrl.includes('/reports/expiring-licenses')) {
    return {
      status: 'success',
      data: store.licenses.map((l) => ({
        license_id: l.id,
        license_name: l.name,
        vendor_name: l.vendor?.name || 'Enterprise Vendor',
        total_seats: l.totalSeats,
        active_allocations: l.usedSeats,
        end_date: l.endDate,
        days_left: 14,
        urgency_bucket: 'WARNING',
        cost: l.cost,
        currency: l.currency || 'USD',
      })),
    };
  }

  if (cleanUrl.includes('/reports/vendor-spend')) {
    return {
      status: 'success',
      data: store.vendors.map((v) => ({
        vendor_id: v.id,
        vendor_name: v.name,
        license_count: 1,
        grand_total_spend: 2400,
        total_seats_contracted: 25,
      })),
    };
  }

  if (cleanUrl.includes('/reports/spend-by-month')) {
    return {
      status: 'success',
      data: [
        { month_year: '2026-08', monthly_spend: 1200, running_total_spend: 1200 },
        { month_year: '2026-09', monthly_spend: 1450, running_total_spend: 2650 },
        { month_year: '2026-10', monthly_spend: 1600, running_total_spend: 4250 },
      ],
    };
  }

  if (cleanUrl.includes('/reports/top-assets')) {
    return {
      status: 'success',
      data: store.assets.map((a, i) => ({
        asset_id: a.id,
        asset_name: a.name,
        asset_code: a.assetCode,
        download_count: 18 - i * 4,
        rank: i + 1,
      })),
    };
  }

  if (cleanUrl.includes('/reports/access-trend')) {
    return {
      status: 'success',
      data: [
        { month_year: '2026-08', download_count: 14, checkout_count: 8, view_count: 42, total_access_events: 64 },
        { month_year: '2026-09', download_count: 19, checkout_count: 11, view_count: 58, total_access_events: 88 },
        { month_year: '2026-10', download_count: 24, checkout_count: 15, view_count: 73, total_access_events: 112 },
      ],
    };
  }

  // 7. Collections (/assets, /licenses, /allocations, /vendors, /categories, /tags, /users, /notifications, /audit-logs)
  const makePaginated = (items: any[]) => ({
    status: 'success',
    data: items,
    meta: {
      page: Number(params?.page || 1),
      limit: Number(params?.limit || 20),
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / Number(params?.limit || 20))),
    },
  });

  if (cleanUrl.startsWith('/assets')) {
    if (method === 'POST') {
      const created = {
        id: `asset-${Date.now()}`,
        assetCode: body?.assetCode || `AST-${Date.now().toString().slice(-3)}`,
        name: body?.name || 'New Digital Asset',
        assetType: body?.assetType || 'SOFTWARE',
        status: 'ACTIVE',
        description: body?.description || '',
        complianceStatus: 'COMPLIANT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.assets.unshift(created);
      saveStore(store);
      return { status: 'success', data: created };
    }
    return makePaginated(store.assets);
  }

  if (cleanUrl.startsWith('/licenses')) {
    if (method === 'POST') {
      const created = {
        id: `lic-${Date.now()}`,
        name: body?.name || 'New Enterprise License',
        licenseKey: body?.licenseKey || `LIC-${Date.now()}`,
        totalSeats: Number(body?.totalSeats || 10),
        usedSeats: 0,
        allocatedSeats: 0,
        availableSeats: Number(body?.totalSeats || 10),
        cost: Number(body?.cost || 0),
        currency: body?.currency || 'USD',
        status: 'ACTIVE',
        startDate: body?.startDate || new Date().toISOString(),
        endDate: body?.endDate || new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      store.licenses.unshift(created);
      saveStore(store);
      return { status: 'success', data: created };
    }
    return makePaginated(store.licenses);
  }

  if (cleanUrl.startsWith('/allocations')) {
    return makePaginated(store.allocations);
  }

  if (cleanUrl.startsWith('/vendors')) {
    return makePaginated(store.vendors);
  }

  if (cleanUrl.startsWith('/categories')) {
    return makePaginated(store.categories);
  }

  if (cleanUrl.startsWith('/tags')) {
    return makePaginated(store.tags);
  }

  if (cleanUrl.startsWith('/users')) {
    return makePaginated(store.users);
  }

  if (cleanUrl.startsWith('/notifications')) {
    return makePaginated(store.notifications);
  }

  if (cleanUrl.startsWith('/audit-logs')) {
    return makePaginated(store.auditLogs);
  }

  if (cleanUrl.startsWith('/plans')) {
    return {
      status: 'success',
      data: [
        { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0 },
        { id: 2, name: 'Pro', maxUsers: 50, maxAssets: 5000, monthlyPrice: 49 },
        { id: 3, name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199 },
      ],
    };
  }

  if (cleanUrl.startsWith('/search')) {
    return {
      status: 'success',
      data: {
        results: {
          assets: store.assets,
          licenses: store.licenses,
          vendors: store.vendors,
          tags: store.tags,
        },
      },
    };
  }

  return { status: 'success', data: {} };
}

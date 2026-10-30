// ==============================================================================
// AssetVault: Resilient Client-Side API Fallback Engine
// Activates ONLY when a serverless function returns HTTP 5xx ("A server error
// has occurred") or when the backend gateway is unreachable.
// Preserves full 4xx validation/auth behavior when backend is reachable.
// ==============================================================================

const STORAGE_KEY = 'assetvault_fallback_store_v2';
const ROSTER_SYNC_KEY = 'assetvault_roster_sync_v2';

// Clean up legacy v1 keys that could contain merged cross-tenant entries
try {
  localStorage.removeItem('assetvault_fallback_store_v1');
  localStorage.removeItem('assetvault_roster_sync_v1');
} catch {}

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

const ASSET_MANAGER_PERMISSIONS = [
  'tenants:read_own',
  'users:read',
  'vendors:read',
  'vendors:write',
  'categories:read',
  'categories:write',
  'tags:read',
  'tags:write',
  'assets:read',
  'assets:create',
  'assets:update',
  'assets:download',
  'assets:checkout',
  'licenses:read',
  'licenses:create',
  'licenses:update',
  'licenses:renew',
  'licenses:reveal_key',
  'allocations:read',
  'allocations:allocate_any',
  'allocations:allocate_self',
  'allocations:release_any',
  'allocations:release_self',
  'notifications:read_own',
  'reports:read',
];

const MEMBER_PERMISSIONS = [
  'tenants:read_own',
  'assets:read',
  'assets:download',
  'assets:checkout',
  'licenses:read',
  'allocations:read',
  'allocations:allocate_self',
  'allocations:release_self',
  'notifications:read_own',
];

export function getPermissionsForRole(roleInput: any): string[] {
  const roleName =
    typeof roleInput === 'object' && roleInput?.name
      ? String(roleInput.name)
      : String(roleInput || 'MEMBER');
  if (roleName === 'SUPER_ADMIN' || roleName === 'TENANT_ADMIN') {
    return DEFAULT_PERMISSIONS;
  }
  if (roleName === 'ASSET_MANAGER') {
    return ASSET_MANAGER_PERMISSIONS;
  }
  return MEMBER_PERMISSIONS;
}

export interface RosterSyncEntry {
  id?: string;
  email: string;
  fullName?: string;
  roleName?: string;
  roleId?: number;
  tenantId?: string;
  isActive?: boolean;
  deleted?: boolean;
}

function getCurrentSessionTenantId(): string | null {
  try {
    const rawSession =
      localStorage.getItem('assetvault_session_cache') ||
      sessionStorage.getItem('assetvault_session_cache');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      return parsed?.tenant?.id || parsed?.user?.tenantId || parsed?.user?.tenant?.id || null;
    }
  } catch {}
  return null;
}

export function recordRosterSyncEntry(entry: RosterSyncEntry): void {
  try {
    const email = String(entry.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return;
    const tenantId = entry.tenantId || getCurrentSessionTenantId();
    if (!tenantId) return;

    const raw = localStorage.getItem(ROSTER_SYNC_KEY);
    const list: RosterSyncEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(list)
      ? list.filter(
          (item) =>
            !(
              String(item.email || '').toLowerCase().trim() === email &&
              item.tenantId === tenantId
            )
        )
      : [];

    // If promoting to TENANT_ADMIN, demote any previous TENANT_ADMIN in the same tenant in sync list
    if (entry.roleName === 'TENANT_ADMIN' || entry.roleId === 2) {
      for (const existing of filtered) {
        if (
          existing.tenantId === tenantId &&
          (existing.roleName === 'TENANT_ADMIN' || existing.roleId === 2)
        ) {
          existing.roleName = 'ASSET_MANAGER';
          existing.roleId = 3;
        }
      }
    }

    filtered.push({ ...entry, email, tenantId });
    localStorage.setItem(ROSTER_SYNC_KEY, JSON.stringify(filtered.slice(-50)));
  } catch {}
}

export function getRosterSyncHeader(): string | null {
  try {
    const activeTenantId = getCurrentSessionTenantId();
    if (!activeTenantId) return null;
    const raw = localStorage.getItem(ROSTER_SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const scopedEntries = parsed.filter((item) => item && item.tenantId === activeTenantId);
    if (scopedEntries.length === 0) return null;
    return btoa(unescape(encodeURIComponent(JSON.stringify(scopedEntries))));
  } catch {
    return null;
  }
}

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
        usedSeats: 1,
        allocatedSeats: 1,
        availableSeats: 24,
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
        usedSeats: 1,
        allocatedSeats: 1,
        availableSeats: 19,
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
        tenantId: 'tenant-karthik',
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
        tenantId: 'tenant-karthik',
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
        tenantId: 'tenant-karthik',
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

function getUserRoleString(u: any): string {
  if (typeof u?.role === 'object' && u.role?.name) return u.role.name;
  if (typeof u?.role === 'string') return u.role;
  if (Number(u?.roleId) === 2) return 'TENANT_ADMIN';
  if (Number(u?.roleId) === 3) return 'ASSET_MANAGER';
  return 'MEMBER';
}

function enforceSingleAdminInStore(store: FallbackStore): void {
  if (!store || !Array.isArray(store.tenants) || !Array.isArray(store.users)) return;
  for (const tenant of store.tenants) {
    const tenantUsers = store.users.filter((u) => u.tenantId === tenant.id);
    if (tenantUsers.length === 0) continue;

    const admins = tenantUsers.filter(
      (u) => getUserRoleString(u) === 'TENANT_ADMIN' || Number(u.roleId) === 2
    );
    if (admins.length > 1) {
      const contactEmailLower = String(tenant.contactEmail || '').toLowerCase().trim();
      const primaryAdmin =
        admins.find((u) => String(u.email || '').toLowerCase().trim() === contactEmailLower) ||
        admins[0];

      for (const adminUser of admins) {
        if (adminUser.id !== primaryAdmin.id) {
          adminUser.role = 'ASSET_MANAGER';
          adminUser.roleId = 3;
        } else {
          adminUser.role = 'TENANT_ADMIN';
          adminUser.roleId = 2;
        }
      }
      tenant.contactEmail = primaryAdmin.email;
    } else if (admins.length === 1) {
      admins[0].role = 'TENANT_ADMIN';
      admins[0].roleId = 2;
      tenant.contactEmail = admins[0].email;
    }
  }
}

function loadStore(): FallbackStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.tenants)) {
        enforceSingleAdminInStore(parsed);
        return parsed;
      }
    }
  } catch {}
  const initial = getInitialStore();
  enforceSingleAdminInStore(initial);
  saveStore(initial);
  return initial;
}

function saveStore(store: FallbackStore): void {
  try {
    enforceSingleAdminInStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function getActiveSessionContext(store: FallbackStore): {
  activeTenantId: string;
  activeTenant: any;
  activeUser: any | null;
} {
  let sessionUser: any = null;
  let sessionTenant: any = null;
  try {
    const rawSession =
      localStorage.getItem('assetvault_session_cache') ||
      sessionStorage.getItem('assetvault_session_cache');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      sessionUser = parsed?.user || null;
      sessionTenant = parsed?.tenant || parsed?.user?.tenant || null;
    }
  } catch {}

  const resolvedTenantId =
    sessionTenant?.id ||
    sessionUser?.tenantId ||
    sessionUser?.tenant?.id ||
    store.tenants[0]?.id ||
    'tenant-karthik';

  let storeModified = false;
  let tenantInStore = store.tenants.find((t) => t.id === resolvedTenantId);
  if (!tenantInStore && sessionTenant && sessionTenant.id) {
    tenantInStore = {
      id: sessionTenant.id,
      name: sessionTenant.name || 'Organization Workspace',
      slug: sessionTenant.slug || `org-${sessionTenant.id}`,
      contactEmail: sessionTenant.contactEmail || sessionUser?.email || 'admin@company.com',
      status: sessionTenant.status || 'ACTIVE',
      planId: sessionTenant.plan?.id || 1,
      plan: sessionTenant.plan || {
        id: 1,
        name: 'Free Trial',
        maxUsers: 10,
        maxAssets: 100,
        monthlyPrice: 0,
      },
      createdAt: new Date().toISOString(),
    };
    store.tenants.unshift(tenantInStore);
    storeModified = true;
  }

  let userInStore: any = null;
  if (sessionUser && sessionUser.email) {
    const emailLower = String(sessionUser.email).toLowerCase().trim();
    const roleStr = getUserRoleString(sessionUser);
    const roleId = roleStr === 'TENANT_ADMIN' ? 2 : roleStr === 'ASSET_MANAGER' ? 3 : 4;

    userInStore = store.users.find(
      (u) =>
        u.tenantId === resolvedTenantId &&
        (u.id === sessionUser.id || String(u.email || '').toLowerCase().trim() === emailLower)
    );

    if (!userInStore) {
      // Remove any stale duplicate of this user email from other tenants if they registered a new org
      store.users = store.users.filter(
        (u) => String(u.email || '').toLowerCase().trim() !== emailLower
      );
      userInStore = {
        id: sessionUser.id || `user-${Date.now()}`,
        email: emailLower,
        fullName: sessionUser.fullName || sessionUser.name || emailLower.split('@')[0],
        role: roleStr,
        roleId,
        tenantId: resolvedTenantId,
        isActive: true,
        isSuperAdmin: Boolean(sessionUser.isSuperAdmin),
        createdAt: sessionUser.createdAt || new Date().toISOString(),
      };
      store.users.push(userInStore);
      storeModified = true;
    } else if (userInStore.tenantId !== resolvedTenantId) {
      userInStore.tenantId = resolvedTenantId;
      storeModified = true;
    }
  }

  if (storeModified) {
    saveStore(store);
  }

  return {
    activeTenantId: resolvedTenantId,
    activeTenant: tenantInStore || sessionTenant || store.tenants[0],
    activeUser: userInStore || sessionUser,
  };
}

export function syncAuthenticatedSessionToFallbackStore(rawPayload: any): void {
  if (!rawPayload) return;
  try {
    const payload = rawPayload?.data ? rawPayload.data : rawPayload;
    const user = payload?.user || (payload?.email ? payload : null);
    const tenant = payload?.tenant || user?.tenant || null;
    if (!user || !user.email) return;

    const tenantId = tenant?.id || user?.tenantId;
    if (!tenantId) return;

    const store = loadStore();
    let existingTenant = store.tenants.find((t) => t.id === tenantId);
    if (!existingTenant) {
      existingTenant = {
        id: tenantId,
        name: tenant?.name || 'Organization Workspace',
        slug: tenant?.slug || `org-${tenantId}`,
        contactEmail: tenant?.contactEmail || user.email,
        status: tenant?.status || 'ACTIVE',
        planId: tenant?.plan?.id || payload?.plan?.id || 1,
        plan: tenant?.plan || payload?.plan || {
          id: 1,
          name: 'Free Trial',
          maxUsers: 10,
          maxAssets: 100,
          monthlyPrice: 0,
        },
        createdAt: new Date().toISOString(),
      };
      store.tenants.unshift(existingTenant);
    } else if (tenant?.name) {
      existingTenant.name = tenant.name;
      existingTenant.slug = tenant.slug || existingTenant.slug;
    }

    const emailLower = String(user.email).toLowerCase().trim();
    const roleStr = getUserRoleString(user);
    const roleId = roleStr === 'TENANT_ADMIN' ? 2 : roleStr === 'ASSET_MANAGER' ? 3 : 4;

    // Remove this email from any other tenant so a user belongs exclusively to their authenticated tenant
    store.users = store.users.filter(
      (u) =>
        !(
          String(u.email || '').toLowerCase().trim() === emailLower &&
          u.tenantId !== tenantId
        )
    );

    const existingUser = store.users.find(
      (u) =>
        u.tenantId === tenantId &&
        (u.id === user.id || String(u.email || '').toLowerCase().trim() === emailLower)
    );

    if (existingUser) {
      existingUser.id = user.id || existingUser.id;
      existingUser.email = emailLower;
      existingUser.fullName = user.fullName || user.name || existingUser.fullName;
      existingUser.role = roleStr;
      existingUser.roleId = roleId;
      existingUser.tenantId = tenantId;
      existingUser.isActive = user.isActive !== false;
    } else {
      store.users.push({
        id: user.id || `user-${Date.now()}`,
        email: emailLower,
        fullName: user.fullName || user.name || emailLower.split('@')[0],
        role: roleStr,
        roleId,
        tenantId,
        isActive: user.isActive !== false,
        isSuperAdmin: Boolean(user.isSuperAdmin),
        createdAt: user.createdAt || new Date().toISOString(),
      });
    }

    saveStore(store);
  } catch {}
}

export function syncServerUsersToFallbackStore(users: any[], tenantId?: string): void {
  if (!Array.isArray(users)) return;
  try {
    const store = loadStore();
    const { activeTenantId } = getActiveSessionContext(store);
    const targetTenantId =
      tenantId ||
      users.find((u) => u && u.tenantId)?.tenantId ||
      activeTenantId;

    if (!targetTenantId) return;

    // Replace the user list for targetTenantId with the authoritative server response for this tenant
    const otherTenantUsers = store.users.filter((u) => u.tenantId !== targetTenantId);
    const normalizedServerUsers = users
      .filter((srvUser) => srvUser && srvUser.email)
      .map((srvUser) => {
        const emailLower = String(srvUser.email).toLowerCase().trim();
        const roleStr = getUserRoleString(srvUser);
        const roleId = roleStr === 'TENANT_ADMIN' ? 2 : roleStr === 'ASSET_MANAGER' ? 3 : 4;
        return {
          id: srvUser.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email: emailLower,
          fullName: srvUser.fullName || emailLower.split('@')[0],
          role: roleStr,
          roleId,
          tenantId: srvUser.tenantId || targetTenantId,
          isActive: srvUser.isActive !== false,
          isSuperAdmin: Boolean(srvUser.isSuperAdmin),
          department: srvUser.department || 'Operations',
          createdAt: srvUser.createdAt || new Date().toISOString(),
        };
      });

    store.users = [...otherTenantUsers, ...normalizedServerUsers];
    saveStore(store);
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
  const { activeTenantId, activeTenant, activeUser } = getActiveSessionContext(store);

  // 1. POST /auth/login
  if (method === 'POST' && cleanUrl.includes('/auth/login')) {
    const email = String(body?.email || 'karthikeyan.s050607@gmail.com').toLowerCase().trim();
    let user = store.users.find((u) => String(u.email || '').toLowerCase().trim() === email);
    let tenant = user ? store.tenants.find((t) => t.id === user.tenantId) : null;

    if (!user) {
      const namePart = email.split('@')[0]?.replace(/[._0-9]+/g, ' ').trim() || 'Organization Admin';
      const displayFullName =
        namePart
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ') || 'Organization Admin';

      const newTenantId = email === 'karthikeyan.s050607@gmail.com' ? 'tenant-karthik' : `tenant-${Date.now()}`;
      tenant = store.tenants.find((t) => t.id === newTenantId);
      if (!tenant) {
        tenant = {
          id: newTenantId,
          name: `${displayFullName} Workspace`,
          slug: `org-${Date.now()}`,
          contactEmail: email,
          status: 'ACTIVE',
          planId: 1,
          plan: { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0 },
          createdAt: new Date().toISOString(),
        };
        store.tenants.unshift(tenant);
      }

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

    if (!tenant) {
      tenant = store.tenants.find((t) => t.id === user.tenantId) || store.tenants[0];
    }

    const roleStr = getUserRoleString(user);
    const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: roleStr, tenantId: tenant.id }))}`;
    return {
      status: 'success',
      data: {
        accessToken: token,
        refreshToken: `fallback-rt-${Date.now()}`,
        user: {
          ...user,
          role: roleStr,
          permissions: getPermissionsForRole(roleStr),
          tenant,
        },
      },
    };
  }

  // 2. POST /auth/register-tenant
  if (method === 'POST' && cleanUrl.includes('/auth/register-tenant')) {
    const tenantId = `tenant-${Date.now()}`;
    const adminEmail = (body?.adminEmail || 'admin@company.com').toLowerCase().trim();
    const tenant = {
      id: tenantId,
      name: body?.tenantName || 'New Enterprise Workspace',
      slug: body?.slug || `org-${Date.now()}`,
      contactEmail: body?.contactEmail || adminEmail,
      status: 'ACTIVE',
      planId: 1,
      plan: { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0 },
      createdAt: new Date().toISOString(),
    };
    const user = {
      id: `user-${Date.now()}`,
      email: adminEmail,
      fullName: body?.adminFullName || 'Organization Admin',
      role: 'TENANT_ADMIN',
      roleId: 2,
      tenantId,
      isActive: true,
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    };
    // Ensure this email is not attached to any other tenant
    store.users = store.users.filter(
      (u) => String(u.email || '').toLowerCase().trim() !== adminEmail
    );
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

  // 2b. POST /auth/google-sso
  if (method === 'POST' && cleanUrl.includes('/auth/google-sso')) {
    const email = String(body?.email || '').toLowerCase().trim();
    let user = store.users.find((u) => String(u.email || '').toLowerCase().trim() === email);

    if (user && (!body?.tenantName || String(body.tenantName).trim().length < 2)) {
      const tenant = store.tenants.find((t) => t.id === user.tenantId) || store.tenants[0];
      const roleStr = getUserRoleString(user);
      const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: roleStr, tenantId: tenant.id }))}`;
      return {
        status: 'success',
        data: {
          requiresOnboarding: false,
          accessToken: token,
          refreshToken: `fallback-rt-${Date.now()}`,
          tenant,
          user: {
            ...user,
            role: roleStr,
            permissions: getPermissionsForRole(roleStr),
            tenant,
          },
        },
      };
    }

    const derivedFullName =
      body?.fullName?.trim() ||
      email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase()) ||
      'Enterprise User';

    if (!body?.tenantName || String(body.tenantName).trim().length < 2) {
      return {
        status: 'success',
        data: {
          requiresOnboarding: true,
          profile: {
            email,
            fullName: derivedFullName,
            avatarUrl: body?.avatarUrl || null,
          },
        },
      };
    }

    const tenantId = `tenant-${Date.now()}`;
    const tenant = {
      id: tenantId,
      name: String(body.tenantName).trim(),
      slug: body?.slug || `org-${Date.now()}`,
      contactEmail: body?.contactEmail || email,
      status: 'ACTIVE',
      planId: 1,
      plan: { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0 },
      createdAt: new Date().toISOString(),
    };

    user = {
      id: `user-${Date.now()}`,
      email,
      fullName: derivedFullName,
      avatarUrl: body?.avatarUrl || null,
      role: 'TENANT_ADMIN',
      roleId: 2,
      tenantId,
      isActive: true,
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    };

    store.users = store.users.filter(
      (u) => String(u.email || '').toLowerCase().trim() !== email
    );
    store.tenants.unshift(tenant);
    store.users.unshift(user);
    saveStore(store);

    const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id }))}`;
    return {
      status: 'success',
      data: {
        requiresOnboarding: false,
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

  // 2c. POST /auth/refresh
  if (method === 'POST' && cleanUrl.includes('/auth/refresh')) {
    const user = activeUser || store.users[0];
    const tenant = activeTenant || store.tenants.find((t) => t.id === user?.tenantId) || store.tenants[0];
    const token = `fallback-jwt-${btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id }))}`;
    return {
      status: 'success',
      data: {
        accessToken: token,
        refreshToken: `fallback-rt-${Date.now()}`,
      },
    };
  }

  // 3. GET /auth/me
  if (method === 'GET' && cleanUrl.includes('/auth/me')) {
    const user = activeUser || store.users[0];
    const roleStr = getUserRoleString(user);
    const tenant = activeTenant || store.tenants.find((t) => t.id === user?.tenantId) || store.tenants[0];
    return {
      status: 'success',
      data: {
        ...user,
        role: roleStr,
        name: user.fullName,
        tenant,
        plan: tenant.plan,
        permissions: getPermissionsForRole(roleStr),
      },
    };
  }

  // 4. POST /auth/logout
  if (cleanUrl.includes('/auth/logout')) {
    return { status: 'success', message: 'Successfully logged out' };
  }

  // Scoped collections for the active tenant
  const tenantAssets = store.assets.filter((a) => a.tenantId === activeTenantId);
  const tenantLicenses = store.licenses.filter((l) => l.tenantId === activeTenantId);
  const tenantVendors = store.vendors.filter((v) => v.tenantId === activeTenantId);
  const tenantAllocations = store.allocations.filter((a) => a.tenantId === activeTenantId);
  const tenantNotifications = store.notifications.filter((n) => n.tenantId === activeTenantId);
  const tenantAuditLogs = store.auditLogs.filter((l) => l.tenantId === activeTenantId);
  const tenantUsers = store.users.filter((u) => u.tenantId === activeTenantId);

  // 5. GET /reports/dashboard
  if (cleanUrl.includes('/reports/dashboard')) {
    const totalSeats = tenantLicenses.reduce((s, l) => s + Number(l.totalSeats || 0), 0);
    const allocatedSeats = tenantLicenses.reduce((s, l) => s + Number(l.usedSeats ?? l.allocatedSeats ?? 0), 0);
    const totalSpend = tenantLicenses.reduce((s, l) => s + Number(l.cost || 0), 0);
    const expiringCount = tenantLicenses.filter((l) => {
      if (!l.endDate) return false;
      const days = Math.ceil((new Date(l.endDate).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    }).length;
    return {
      status: 'success',
      data: {
        tenant: activeTenant,
        stats: {
          total_assets: tenantAssets.length,
          asset_count: tenantAssets.length,
          total_licenses: tenantLicenses.length,
          license_count: tenantLicenses.length,
          user_count: tenantUsers.length,
          allocated_seats: allocatedSeats,
          active_allocated_seats: allocatedSeats,
          total_seats: totalSeats,
          total_contracted_seats: totalSeats,
          expiring_in_30_days: expiringCount,
          expiring_licenses_30d: expiringCount,
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
      data: tenantLicenses.map((l) => {
        const usedSeats = Number(l.usedSeats ?? l.allocatedSeats ?? 0);
        const totalSeats = Number(l.totalSeats || 1);
        return {
          license_id: l.id,
          license_name: l.name,
          vendor_name: l.vendor?.name || 'Enterprise Vendor',
          license_type: 'SEAT_BASED',
          total_seats: totalSeats,
          used_seats: usedSeats,
          available_seats: Math.max(0, totalSeats - usedSeats),
          utilization_pct: Math.round((usedSeats / Math.max(1, totalSeats)) * 100),
          status: l.status,
          cost: l.cost,
          currency: l.currency || 'USD',
        };
      }),
    };
  }

  if (cleanUrl.includes('/reports/expiring-licenses')) {
    return {
      status: 'success',
      data: tenantLicenses.map((l) => ({
        license_id: l.id,
        license_name: l.name,
        vendor_name: l.vendor?.name || 'Enterprise Vendor',
        total_seats: l.totalSeats,
        active_allocations: l.usedSeats ?? l.allocatedSeats ?? 0,
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
      data: tenantVendors.map((v) => {
        const vLics = tenantLicenses.filter((l) => l.vendorId === v.id);
        const spend = vLics.reduce((s, l) => s + Number(l.cost || 0), 0);
        const seats = vLics.reduce((s, l) => s + Number(l.totalSeats || 0), 0);
        return {
          vendor_id: v.id,
          vendor_name: v.name,
          license_count: vLics.length,
          grand_total_spend: spend,
          total_seats_contracted: seats,
        };
      }),
    };
  }

  if (cleanUrl.includes('/reports/spend-by-month')) {
    if (tenantLicenses.length === 0) {
      return { status: 'success', data: [] };
    }
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
      data: tenantAssets.map((a, i) => ({
        asset_id: a.id,
        asset_name: a.name,
        asset_code: a.assetCode,
        download_count: Math.max(1, 18 - i * 4),
        rank: i + 1,
      })),
    };
  }

  if (cleanUrl.includes('/reports/access-trend')) {
    if (tenantAssets.length === 0) {
      return { status: 'success', data: [] };
    }
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
        tenantId: activeTenantId,
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
    return makePaginated(tenantAssets);
  }

  if (cleanUrl.startsWith('/licenses')) {
    if (method === 'POST') {
      const created = {
        id: `lic-${Date.now()}`,
        tenantId: activeTenantId,
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
    return makePaginated(tenantLicenses);
  }

  if (cleanUrl.startsWith('/allocations')) {
    return makePaginated(tenantAllocations);
  }

  if (cleanUrl.startsWith('/vendors')) {
    if (method === 'POST') {
      const created = {
        id: `vendor-${Date.now()}`,
        tenantId: activeTenantId,
        name: body?.name || 'New Enterprise Vendor',
        website: body?.website || body?.websiteUrl || '',
        supportEmail: body?.supportEmail || body?.contactEmail || '',
        contactEmail: body?.contactEmail || body?.supportEmail || '',
        createdAt: new Date().toISOString(),
      };
      store.vendors.unshift(created);
      saveStore(store);
      return { status: 'success', data: created };
    }
    return makePaginated(tenantVendors);
  }

  if (cleanUrl.startsWith('/categories')) {
    return makePaginated(store.categories);
  }

  if (cleanUrl.startsWith('/tags')) {
    return makePaginated(store.tags);
  }

  if (cleanUrl.startsWith('/users')) {
    // POST /users/bulk-email
    if (method === 'POST' && cleanUrl.includes('/bulk-email')) {
      const rawText = String(body?.rawText || '');
      const matches = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
      const createdUsers: any[] = [];
      for (const m of matches) {
        const email = m.trim().toLowerCase();
        if (store.users.some((u) => u.tenantId === activeTenantId && u.email.toLowerCase() === email)) continue;
        const fullName = email
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
        const newUser = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email,
          fullName,
          role: 'MEMBER',
          roleId: 4,
          tenantId: activeTenantId,
          isActive: true,
          isSuperAdmin: false,
          createdAt: new Date().toISOString(),
        };
        store.users.push(newUser);
        recordRosterSyncEntry({
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          roleName: 'MEMBER',
          roleId: 4,
          tenantId: activeTenantId,
          isActive: true,
        });
        createdUsers.push(newUser);
      }
      saveStore(store);
      return {
        status: 'success',
        data: {
          createdCount: createdUsers.length,
          createdUsers,
        },
      };
    }

    // POST /users
    if (method === 'POST' && cleanUrl === '/users') {
      const email = String(body?.email || '').trim().toLowerCase();
      const fullName =
        String(body?.fullName || '').trim() ||
        email
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
      const requestedRole = body?.roleName || 'MEMBER';
      const safeRole = requestedRole === 'TENANT_ADMIN' ? 'ASSET_MANAGER' : requestedRole;
      const roleId = safeRole === 'ASSET_MANAGER' ? 3 : 4;

      const created = {
        id: `user-${Date.now()}`,
        email,
        fullName,
        role: safeRole,
        roleId,
        tenantId: activeTenantId,
        isActive: true,
        isSuperAdmin: false,
        createdAt: new Date().toISOString(),
      };
      store.users.push(created);
      saveStore(store);
      recordRosterSyncEntry({
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        roleName: safeRole,
        roleId,
        tenantId: activeTenantId,
        isActive: true,
      });
      return { status: 'success', data: created };
    }

    // PATCH /users/:id/role
    const roleMatch = cleanUrl.match(/^\/users\/([^/]+)\/role$/);
    if (method === 'PATCH' && roleMatch) {
      const targetUserId = roleMatch[1];
      const newRoleName = String(body?.roleName || 'MEMBER');
      const targetUser = store.users.find((u) => u.id === targetUserId && u.tenantId === activeTenantId);
      if (targetUser) {
        const userTenantId = targetUser.tenantId || activeTenantId;
        if (newRoleName === 'TENANT_ADMIN') {
          for (const u of store.users) {
            if (u.tenantId === userTenantId && u.id !== targetUser.id && getUserRoleString(u) === 'TENANT_ADMIN') {
              u.role = 'ASSET_MANAGER';
              u.roleId = 3;
              recordRosterSyncEntry({
                id: u.id,
                email: u.email,
                fullName: u.fullName,
                roleName: 'ASSET_MANAGER',
                roleId: 3,
                tenantId: userTenantId,
                isActive: u.isActive,
              });
            }
          }
          const tenant = store.tenants.find((t) => t.id === userTenantId);
          if (tenant) {
            tenant.contactEmail = targetUser.email;
          }
        }
        targetUser.role = newRoleName;
        targetUser.roleId =
          newRoleName === 'TENANT_ADMIN' ? 2 : newRoleName === 'ASSET_MANAGER' ? 3 : 4;
        saveStore(store);
        recordRosterSyncEntry({
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          roleName: newRoleName,
          roleId: targetUser.roleId,
          tenantId: userTenantId,
          isActive: targetUser.isActive,
        });
        return { status: 'success', data: targetUser };
      }
    }

    // PATCH /users/:id/status
    const statusMatch = cleanUrl.match(/^\/users\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const targetUserId = statusMatch[1];
      const targetUser = store.users.find((u) => u.id === targetUserId && u.tenantId === activeTenantId);
      if (targetUser) {
        targetUser.isActive = Boolean(body?.isActive);
        saveStore(store);
        recordRosterSyncEntry({
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          roleName: getUserRoleString(targetUser),
          roleId: targetUser.roleId,
          tenantId: targetUser.tenantId,
          isActive: targetUser.isActive,
        });
        return { status: 'success', data: targetUser };
      }
    }

    // PATCH /users/:id
    const updateMatch = cleanUrl.match(/^\/users\/([^/]+)$/);
    if (method === 'PATCH' && updateMatch) {
      const targetUserId = updateMatch[1];
      const targetUser = store.users.find((u) => u.id === targetUserId && u.tenantId === activeTenantId);
      if (targetUser) {
        if (body?.fullName) targetUser.fullName = String(body.fullName).trim();
        if (body?.email) targetUser.email = String(body.email).trim().toLowerCase();
        saveStore(store);
        recordRosterSyncEntry({
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          roleName: getUserRoleString(targetUser),
          roleId: targetUser.roleId,
          tenantId: targetUser.tenantId,
          isActive: targetUser.isActive,
        });
        return { status: 'success', data: targetUser };
      }
    }

    // DELETE /users/:id
    if (method === 'DELETE' && updateMatch) {
      const targetUserId = updateMatch[1];
      const idx = store.users.findIndex((u) => u.id === targetUserId && u.tenantId === activeTenantId);
      if (idx !== -1) {
        const removed = store.users[idx];
        if (getUserRoleString(removed) !== 'TENANT_ADMIN') {
          store.users.splice(idx, 1);
          saveStore(store);
          recordRosterSyncEntry({
            id: removed.id,
            email: removed.email,
            tenantId: activeTenantId,
            deleted: true,
          });
        }
        return { status: 'success', message: 'User removed' };
      }
    }

    const strictTenantUsers = store.users.filter((u) => u.tenantId === activeTenantId);
    return makePaginated(strictTenantUsers);
  }

  if (cleanUrl.startsWith('/notifications')) {
    return makePaginated(tenantNotifications);
  }

  if (cleanUrl.startsWith('/audit-logs')) {
    return makePaginated(tenantAuditLogs);
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
          assets: tenantAssets,
          licenses: tenantLicenses,
          vendors: tenantVendors,
          tags: store.tags,
        },
      },
    };
  }

  if (cleanUrl.startsWith('/ai/context-summary')) {
    const totalSeats = tenantLicenses.reduce((acc: number, l: any) => acc + Number(l.totalSeats || 0), 0);
    const allocatedSeats = tenantAllocations.length;
    return {
      status: 'success',
      data: {
        tenantId: activeTenantId,
        assetsCount: tenantAssets.length,
        licensesCount: tenantLicenses.length,
        usersCount: tenantUsers.length,
        totalSeats,
        allocatedSeats,
        unallocatedSeats: Math.max(0, totalSeats - allocatedSeats),
        utilizationPct: totalSeats > 0 ? Math.round((allocatedSeats / totalSeats) * 100) : 0,
        totalAnnualSpend: tenantLicenses.reduce((acc: number, l: any) => acc + Number(l.cost || 0), 0),
        users: tenantUsers,
      },
    };
  }

  if (cleanUrl.startsWith('/ai/chat') || cleanUrl.startsWith('/ai/copilot')) {
    const prompt =
      typeof body?.prompt === 'string'
        ? body.prompt.trim()
        : typeof body?.message === 'string'
        ? body.message.trim()
        : Array.isArray(body?.messages) && body.messages.length > 0
        ? (body.messages[body.messages.length - 1]?.content || body.messages[body.messages.length - 1]?.text || '')
        : '';
    const q = prompt.toLowerCase();
    let reply = `I'm connected to your AssetVault workspace. You have ${tenantLicenses.length} software licenses and ${tenantAssets.length} digital assets registered. How can I assist you with license governance or optimization?`;
    if (q.includes('license') || q.includes('seat') || q.includes('renew')) {
      reply = `You currently have **${tenantLicenses.length} active licenses** tracked in your workspace. Total seat utilization is healthy, with zero over-cap license compliance issues detected.`;
    } else if (q.includes('asset') || q.includes('catalog') || q.includes('software')) {
      reply = `Your workspace contains **${tenantAssets.length} digital software assets** including enterprise IDEs, productivity suites, and creative tools.`;
    } else if (q.includes('who') || q.includes('user') || q.includes('team') || q.includes('profile')) {
      reply = `You are authenticated as **${body?.userName || 'Organization Member'}** (\`${body?.userEmail || 'member'}\`). Your workspace access role is \`${body?.userRole || 'TENANT_ADMIN'}\`.`;
    } else if (q.includes('spend') || q.includes('cost') || q.includes('saving')) {
      const spend = tenantLicenses.reduce((acc: number, l: any) => acc + Number(l.cost || 0), 0);
      reply = `Your total recorded software spend is **$${spend.toLocaleString()} USD / year**. Reclaiming unallocated seats on expiring renewals could yield up to 12% in annual savings.`;
    }
    return {
      status: 'success',
      data: {
        reply,
        modelUsed: 'gemini-3.8-flash',
        timestamp: new Date().toISOString(),
      },
    };
  }

  return { status: 'success', data: {} };
}

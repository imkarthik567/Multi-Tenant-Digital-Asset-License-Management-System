export type RoleName = 'super_admin' | 'tenant_admin' | 'asset_manager' | 'member' | 'auditor';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roleId: number;
  role: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial';
  subscriptionTier: 'free' | 'standard' | 'enterprise';
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  parentCategoryId?: string | null;
  parentCategory?: { id: string; name: string } | null;
  subCategories?: { id: string; name: string }[];
  _count?: { assets: number };
}

export interface Tag {
  id: string;
  name: string;
  colorHex: string;
  _count?: { assetTags: number };
}

export interface Vendor {
  id: string;
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  _count?: { licenses: number };
}

export interface Asset {
  id: string;
  name: string;
  assetType: 'font' | 'image' | 'software' | 'dataset' | 'video' | 'document' | 'other';
  description?: string | null;
  fileUrl?: string | null;
  fileSizeBytes?: string | number | null;
  mimeType?: string | null;
  version: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  category: { id: string; name: string };
  createdByUser?: { id: string; fullName: string; email: string } | null;
  assetTags: { tag: Tag }[];
  assetLicenses: {
    license: {
      id: string;
      name: string;
      licenseType: string;
      expiresAt?: string | null;
      status: string;
      vendor: { name: string };
    };
  }[];
}

export interface License {
  id: string;
  name: string;
  licenseKey?: string | null;
  licenseType: 'per_seat' | 'site' | 'subscription' | 'perpetual' | 'open_source';
  totalSeats: number;
  allocatedSeats: number;
  availableSeats: number;
  cost: number | string;
  currency: string;
  startsAt: string;
  expiresAt?: string | null;
  isAutoRenew: boolean;
  renewalReminderDays: number;
  status: 'active' | 'expired' | 'suspended' | 'pending_renewal';
  vendor: { id: string; name: string };
  allocations?: LicenseAllocation[];
  linkedAssetCount?: number;
}

export interface LicenseAllocation {
  id: string;
  licenseId: string;
  userId: string;
  allocatedAt: string;
  revokedAt?: string | null;
  notes?: string | null;
  user?: { id: string; fullName: string; email: string; avatarUrl?: string | null };
  license?: { id: string; name: string; licenseType: string; totalSeats: number; vendor: { name: string } };
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALLOCATE' | 'REVOKE' | 'LOGIN' | 'LOGOUT';
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; email: string; avatarUrl?: string | null } | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'license_expiry' | 'renewal_due' | 'seat_exhaustion' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

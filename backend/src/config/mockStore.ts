// ==============================================================================
// AssetVault - In-Memory Database Mock Store
// Automatically used when PostgreSQL database is unreachable
// Ensures zero-downtime, fully interactive local applet operation
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const BCRYPT_PASSWORD_HASH = '$2a$10$Wdkk2P5XbxNUKMged8lf.ec4X3KILgM4XYxy8hBQ1.8jeYMuvlBIi'; // Password123!

export interface MockStoreState {
  roles: any[];
  plans: any[];
  licenseTypes: any[];
  tenants: any[];
  users: any[];
  vendors: any[];
  categories: any[];
  tags: any[];
  assets: any[];
  assetVersions: any[];
  licenses: any[];
  allocations: any[];
  notifications: any[];
  emailDeliveries: any[];
  auditLogs: any[];
  refreshTokens: any[];
  assetTags: any[];
}

export function createInitialState(): MockStoreState {
  const roles = [
    { id: 1, name: 'SUPER_ADMIN', description: 'Global system platform administrator' },
    { id: 2, name: 'TENANT_ADMIN', description: 'Tenant organization owner with admin privileges' },
    { id: 3, name: 'ASSET_MANAGER', description: 'Asset custodian and license allocator' },
    { id: 4, name: 'MEMBER', description: 'Standard organization member with read & checkout rights' },
  ];

  const plans = [
    { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0.0, isActive: true },
    { id: 2, name: 'Pro', maxUsers: 50, maxAssets: 5000, monthlyPrice: 49.0, isActive: true },
    { id: 3, name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199.0, isActive: true },
  ];

  const licenseTypes = [
    { id: 1, name: 'PERPETUAL', description: 'One-time purchase with indefinite usage rights', isSeatBased: false, isExpirable: false },
    { id: 2, name: 'SUBSCRIPTION', description: 'Recurring time-bound SaaS or enterprise subscription', isSeatBased: false, isExpirable: true },
    { id: 3, name: 'SEAT_BASED', description: 'Named-user or floating seat allocation contract', isSeatBased: true, isExpirable: true },
    { id: 4, name: 'USAGE_BASED', description: 'Metered consumption or API-quota license', isSeatBased: false, isExpirable: true },
    { id: 5, name: 'OPEN_SOURCE', description: 'Permissive or copyleft open-source software license', isSeatBased: false, isExpirable: false },
  ];

  const tenants = [
    {
      id: 'tenant-acme-corp',
      name: 'Acme Corporation',
      slug: 'acme',
      contactEmail: 'admin@acme.com',
      status: 'ACTIVE',
      planId: 2,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tenant-stark-ind',
      name: 'Stark Industries',
      slug: 'stark',
      contactEmail: 'admin@stark.com',
      status: 'ACTIVE',
      planId: 3,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
    {
      id: 'tenant-techcorp',
      name: 'TechCorp Dynamics',
      slug: 'techcorp',
      contactEmail: 'admin@techcorp.com',
      status: 'ACTIVE',
      planId: 3,
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'tenant-innovatelabs',
      name: 'InnovateLabs Inc',
      slug: 'innovatelabs',
      contactEmail: 'admin@innovatelabs.io',
      status: 'ACTIVE',
      planId: 2,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
    {
      id: 'tenant-creativestudio',
      name: 'CreativeStudio Visuals',
      slug: 'creativestudio',
      contactEmail: 'contact@creativestudio.design',
      status: 'ACTIVE',
      planId: 1,
      createdAt: new Date('2026-01-14T00:00:00Z'),
      updatedAt: new Date('2026-01-14T00:00:00Z'),
    },
    {
      id: 'tenant-karthik',
      name: 'Karthik Enterprise Workspace',
      slug: 'karthik-org',
      contactEmail: 'karthikeyan.s050607@gmail.com',
      status: 'ACTIVE',
      planId: 3,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  const users = [
    {
      id: 'user-karthik-admin',
      email: 'karthikeyan.s050607@gmail.com',
      fullName: 'Karthikeyan S',
      roleId: 2,
      tenantId: 'tenant-karthik',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Executive Leadership',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'user-karthik-admin-alt',
      email: 'karthiksmrk7377@gmail.com',
      fullName: 'Karthikeyan S',
      roleId: 2,
      tenantId: 'tenant-karthik',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Executive Leadership',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'user-super-admin',
      email: 'superadmin@assetvault.io',
      fullName: 'Global Super Administrator',
      roleId: 1,
      tenantId: null,
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Executive',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'user-tenant-admin',
      email: 'admin@acme.com',
      fullName: 'Acme Administrator',
      roleId: 2,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'IT Operations',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'user-asset-manager',
      email: 'manager@acme.com',
      fullName: 'Acme Asset Manager',
      roleId: 3,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Procurement',
      createdAt: new Date('2026-01-20T00:00:00Z'),
      updatedAt: new Date('2026-01-20T00:00:00Z'),
    },
    {
      id: 'user-member',
      email: 'member@acme.com',
      fullName: 'Acme Team Member',
      roleId: 4,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Engineering',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
    // TechCorp Dynamics users
    {
      id: 'user-techcorp-admin',
      email: 'techcorp.admin@techcorp.io',
      fullName: 'TechCorp Dynamics Lead Admin',
      roleId: 2,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'IT Operations',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'user-techcorp-mgr1',
      email: 'techcorp.mgr1@techcorp.io',
      fullName: 'TechCorp Dynamics Senior Asset Manager',
      roleId: 3,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Procurement',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'user-techcorp-mgr2',
      email: 'techcorp.mgr2@techcorp.io',
      fullName: 'TechCorp Dynamics Content Specialist',
      roleId: 3,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Operations',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'user-techcorp-dev1',
      email: 'techcorp.dev1@techcorp.io',
      fullName: 'TechCorp Dynamics Engineer Alpha',
      roleId: 4,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Engineering',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'user-techcorp-dev2',
      email: 'techcorp.dev2@techcorp.io',
      fullName: 'TechCorp Dynamics Designer Beta',
      roleId: 4,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Design',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'user-techcorp-dev3',
      email: 'techcorp.dev3@techcorp.io',
      fullName: 'TechCorp Dynamics Security Auditor',
      roleId: 4,
      tenantId: 'tenant-techcorp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Security',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    // InnovateLabs users
    {
      id: 'user-innovatelabs-admin',
      email: 'innovatelabs.admin@innovatelabs.io',
      fullName: 'InnovateLabs Inc Lead Admin',
      roleId: 2,
      tenantId: 'tenant-innovatelabs',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'IT Operations',
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
    {
      id: 'user-innovatelabs-mgr1',
      email: 'innovatelabs.mgr1@innovatelabs.io',
      fullName: 'InnovateLabs Inc Senior Asset Manager',
      roleId: 3,
      tenantId: 'tenant-innovatelabs',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Procurement',
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
    {
      id: 'user-innovatelabs-dev1',
      email: 'innovatelabs.dev1@innovatelabs.io',
      fullName: 'InnovateLabs Inc Engineer Alpha',
      roleId: 4,
      tenantId: 'tenant-innovatelabs',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Engineering',
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
    // CreativeStudio users
    {
      id: 'user-creativestudio-admin',
      email: 'creativestudio.admin@creativestudio.design',
      fullName: 'CreativeStudio Visuals Lead Admin',
      roleId: 2,
      tenantId: 'tenant-creativestudio',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Creative Ops',
      createdAt: new Date('2026-01-14T00:00:00Z'),
      updatedAt: new Date('2026-01-14T00:00:00Z'),
    },
  ];

  const vendors = [
    {
      id: 'vendor-1',
      tenantId: 'tenant-acme-corp',
      name: 'Adobe Systems Inc.',
      contactEmail: 'enterprise-licensing@adobe.com',
      websiteUrl: 'https://www.adobe.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-2',
      tenantId: 'tenant-acme-corp',
      name: 'JetBrains s.r.o.',
      contactEmail: 'sales@jetbrains.com',
      websiteUrl: 'https://www.jetbrains.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-3',
      tenantId: 'tenant-acme-corp',
      name: 'Monotype Imaging Inc.',
      contactEmail: 'licensing@monotype.com',
      websiteUrl: 'https://www.monotype.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-4',
      tenantId: 'tenant-acme-corp',
      name: 'Figma Inc.',
      contactEmail: 'sales@figma.com',
      websiteUrl: 'https://www.figma.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-techcorp-1',
      tenantId: 'tenant-techcorp',
      name: 'Adobe Creative Systems (techcorp)',
      contactEmail: 'licensing@adobe.com',
      website: 'https://adobe.com',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'vendor-innovate-1',
      tenantId: 'tenant-innovatelabs',
      name: 'JetBrains DevTools (innovatelabs)',
      contactEmail: 'sales@jetbrains.com',
      website: 'https://jetbrains.com',
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
  ];

  const categories = [
    {
      id: 'cat-1',
      tenantId: 'tenant-acme-corp',
      name: 'Developer Tools',
      description: 'Integrated Development Environments and CLI utilities',
      parentId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'cat-2',
      tenantId: 'tenant-acme-corp',
      name: 'Creative & Design',
      description: 'UI/UX software, illustration and visual assets',
      parentId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'cat-3',
      tenantId: 'tenant-acme-corp',
      name: 'Typography & Fonts',
      description: 'Commercial font families and web font licenses',
      parentId: 'cat-2',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  const tags = [
    {
      id: 'tag-1',
      tenantId: 'tenant-acme-corp',
      name: 'Core Tooling',
      color: '#3B82F6',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tag-2',
      tenantId: 'tenant-acme-corp',
      name: 'Engineering',
      color: '#10B981',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tag-3',
      tenantId: 'tenant-acme-corp',
      name: 'Brand Guidelines',
      color: '#EC4899',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  const assets = [
    {
      id: 'asset-1',
      tenantId: 'tenant-acme-corp',
      name: 'IntelliJ IDEA Ultimate',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-1',
      vendorId: 'vendor-2',
      description: 'Premier Java, Kotlin & Fullstack development environment for engineering teams.',
      createdAt: new Date('2026-01-16T00:00:00Z'),
      updatedAt: new Date('2026-01-16T00:00:00Z'),
    },
    {
      id: 'asset-2',
      tenantId: 'tenant-acme-corp',
      name: 'Helvetica Neue Pro Complete',
      type: 'FONT',
      status: 'ACTIVE',
      categoryId: 'cat-3',
      vendorId: 'vendor-3',
      description: 'Corporate brand typography family across OpenType and WOFF2 formats.',
      createdAt: new Date('2026-01-17T00:00:00Z'),
      updatedAt: new Date('2026-01-17T00:00:00Z'),
    },
    {
      id: 'asset-3',
      tenantId: 'tenant-acme-corp',
      name: 'Adobe Creative Cloud Suite',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-2',
      vendorId: 'vendor-1',
      description: 'Full suite including Photoshop, Illustrator, Premiere Pro, and After Effects.',
      createdAt: new Date('2026-01-18T00:00:00Z'),
      updatedAt: new Date('2026-01-18T00:00:00Z'),
    },
    {
      id: 'asset-4',
      tenantId: 'tenant-acme-corp',
      name: 'Figma Enterprise Organization',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-2',
      vendorId: 'vendor-4',
      description: 'Collaborative cloud interface design, prototyping and design system maintenance.',
      createdAt: new Date('2026-01-19T00:00:00Z'),
      updatedAt: new Date('2026-01-19T00:00:00Z'),
    },
    {
      id: 'asset-techcorp-1',
      tenantId: 'tenant-techcorp',
      name: 'TechCorp Enterprise Cloud Suite',
      code: 'AST-TC-001',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      ownerId: 'user-techcorp-admin',
      vendorId: 'vendor-techcorp-1',
      description: 'TechCorp core cloud software asset.',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'asset-innovate-1',
      tenantId: 'tenant-innovatelabs',
      name: 'InnovateLabs IDE Suite',
      code: 'AST-IL-001',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      ownerId: 'user-innovatelabs-admin',
      vendorId: 'vendor-innovate-1',
      description: 'InnovateLabs engineering IDE asset.',
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
  ];

  const assetVersions = [
    {
      id: 'ver-1',
      assetId: 'asset-1',
      versionNo: 1,
      versionNumber: '2026.1',
      storageUrl: 'https://download.jetbrains.com/idea/ideaIU-2026.1.tar.gz',
      fileUrl: 'https://download.jetbrains.com/idea/ideaIU-2026.1.tar.gz',
      fileSize: 1048576000,
      fileSizeBytes: 1048576000,
      mimeType: 'application/gzip',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      changelog: 'Initial 2026 release with JDK 25 support',
      changeNotes: 'Initial 2026 release with JDK 25 support',
      uploadedBy: 'user-tenant-admin',
      createdAt: new Date('2026-01-16T00:00:00Z'),
    },
    {
      id: 'ver-2',
      assetId: 'asset-1',
      versionNo: 2,
      versionNumber: '2026.2',
      storageUrl: 'https://download.jetbrains.com/idea/ideaIU-2026.2.tar.gz',
      fileUrl: 'https://download.jetbrains.com/idea/ideaIU-2026.2.tar.gz',
      fileSize: 1059061760,
      fileSizeBytes: 1059061760,
      mimeType: 'application/gzip',
      checksum: 'f4c1d55309fd2d250bgafbf5d5a007fc38bf52f5750ca045da06002c8963c966',
      checksumSha256: 'f4c1d55309fd2d250bgafbf5d5a007fc38bf52f5750ca045da06002c8963c966',
      changelog: 'Maintenance release with updated language servers',
      changeNotes: 'Maintenance release with updated language servers',
      uploadedBy: 'user-tenant-admin',
      createdAt: new Date('2026-02-20T00:00:00Z'),
    },
  ];

  const licenses = [
    {
      id: 'lic-1',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-1',
      vendorId: 'vendor-2',
      licenseTypeId: 3,
      name: 'IntelliJ IDEA Ultimate Enterprise',
      licenseKey: 'JB-INTEL-2026-ACME-99124',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 35,
      allocatedSeats: 2,
      cost: 499.0,
      currency: 'USD',
      autoRenew: true,
      startDate: new Date('2026-01-16T00:00:00Z'),
      endDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-16T00:00:00Z'),
      updatedAt: new Date('2026-01-16T00:00:00Z'),
    },
    {
      id: 'lic-2',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-2',
      vendorId: 'vendor-3',
      licenseTypeId: 1,
      name: 'Helvetica Neue Pro Complete',
      licenseKey: 'MONO-HN-CORP-44091',
      type: 'PERPETUAL',
      status: 'ACTIVE',
      totalSeats: 100,
      allocatedSeats: 1,
      cost: 1450.0,
      currency: 'USD',
      autoRenew: false,
      startDate: new Date('2026-01-17T00:00:00Z'),
      endDate: null,
      expiresAt: null,
      createdAt: new Date('2026-01-17T00:00:00Z'),
      updatedAt: new Date('2026-01-17T00:00:00Z'),
    },
    {
      id: 'lic-3',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-3',
      vendorId: 'vendor-1',
      licenseTypeId: 2,
      name: 'Adobe Creative Cloud Enterprise',
      licenseKey: 'ADBE-CC-ENT-2026-081',
      type: 'SUBSCRIPTION',
      status: 'ACTIVE',
      totalSeats: 20,
      allocatedSeats: 2,
      cost: 899.0,
      currency: 'USD',
      autoRenew: true,
      startDate: new Date('2026-01-18T00:00:00Z'),
      endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-18T00:00:00Z'),
      updatedAt: new Date('2026-01-18T00:00:00Z'),
    },
    {
      id: 'lic-4',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-4',
      vendorId: 'vendor-4',
      licenseTypeId: 3,
      name: 'Figma Enterprise Organization',
      licenseKey: 'FIGMA-ENT-ORGLIC-309',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 25,
      allocatedSeats: 2,
      cost: 750.0,
      currency: 'USD',
      autoRenew: true,
      startDate: new Date('2026-01-19T00:00:00Z'),
      endDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-19T00:00:00Z'),
      updatedAt: new Date('2026-01-19T00:00:00Z'),
    },
    {
      id: 'lic-techcorp-1',
      tenantId: 'tenant-techcorp',
      assetId: 'asset-techcorp-1',
      vendorId: 'vendor-techcorp-1',
      licenseTypeId: 3,
      name: 'TechCorp Enterprise Seat Pack',
      licenseKey: 'TC-ENT-2026-001',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 50,
      allocatedSeats: 1,
      cost: 1200.0,
      currency: 'USD',
      autoRenew: true,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      id: 'lic-innovate-1',
      tenantId: 'tenant-innovatelabs',
      assetId: 'asset-innovate-1',
      vendorId: 'vendor-innovate-1',
      licenseTypeId: 3,
      name: 'InnovateLabs Seat Pack',
      licenseKey: 'IL-ENT-2026-001',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 25,
      allocatedSeats: 1,
      cost: 800.0,
      currency: 'USD',
      autoRenew: true,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-12T00:00:00Z'),
      updatedAt: new Date('2026-01-12T00:00:00Z'),
    },
  ];

  const allocations = [
    {
      id: 'alloc-1',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-1',
      userId: 'user-tenant-admin',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-20T00:00:00Z'),
      notes: 'Lead Infrastructure Engineer seat',
    },
    {
      id: 'alloc-2',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-1',
      userId: 'user-member',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-02-05T00:00:00Z'),
      notes: 'Fullstack Core Dev seat',
    },
    {
      id: 'alloc-3',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-2',
      userId: 'user-asset-manager',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-22T00:00:00Z'),
      notes: 'Design System & Typography Lead',
    },
    {
      id: 'alloc-4',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-3',
      userId: 'user-asset-manager',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-25T00:00:00Z'),
      notes: 'Creative Suite seat',
    },
    {
      id: 'alloc-5',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-3',
      userId: 'user-member',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-02-10T00:00:00Z'),
      notes: 'UI/UX Design Seat',
    },
  ];

  const adobeExpDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const notifications = [
    {
      id: 'notif-1',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      licenseId: 'lic-3',
      type: 'EXPIRY_15',
      title: 'Adobe Creative Cloud Enterprise Expires in 14 Days',
      message: `Automated email alert sent to admin@acme.com: License "Adobe Creative Cloud Enterprise" (ADBE-CC-ENT-2026-081) expires on ${adobeExpDate} (14 days remaining).`,
      isRead: false,
      emailSent: true,
      recipientEmail: 'admin@acme.com',
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
    {
      id: 'notif-2',
      tenantId: 'tenant-acme-corp',
      userId: 'user-member',
      licenseId: 'lic-3',
      type: 'EXPIRY_15',
      title: 'Your Assigned License Expires in 14 Days',
      message: `Automated email alert sent to member@acme.com: Your assigned seat for "Adobe Creative Cloud Enterprise" expires on ${adobeExpDate}.`,
      isRead: false,
      emailSent: true,
      recipientEmail: 'member@acme.com',
      createdAt: new Date(Date.now() - 14 * 60 * 1000),
    },
    {
      id: 'notif-3',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      licenseId: 'lic-1',
      type: 'SYSTEM',
      title: 'Seat Allocated: IntelliJ IDEA Ultimate Enterprise',
      message: 'Automated confirmation email sent to member@acme.com and admin@acme.com for seat allocation on IntelliJ IDEA Ultimate Enterprise.',
      isRead: false,
      emailSent: true,
      recipientEmail: 'member@acme.com',
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
    },
  ];

  const emailDeliveries = [
    {
      id: 'email-log-1',
      tenantId: 'tenant-acme-corp',
      tenantName: 'Acme Corporation',
      recipientUserId: 'user-member',
      recipientEmail: 'member@acme.com',
      recipientName: 'Acme Team Member',
      recipientRole: 'MEMBER',
      licenseId: 'lic-3',
      licenseName: 'Adobe Creative Cloud Enterprise',
      eventType: 'EXPIRY_15',
      subject: '[AssetVault] WARNING (15 DAYS): Adobe Creative Cloud Enterprise',
      bodyText: `Hello Acme Team Member,\n\nThis is an automated notification from your organization workspace Acme Corporation.\n\nYour assigned software license "Adobe Creative Cloud Enterprise" (Key: ADBE-CC-ENT-2026-081) is scheduled to expire on ${adobeExpDate} (14 days remaining).\n\nRecipient Role: Assigned Seat Holder (MEMBER)\nOrganization: Acme Corporation\nAction Required: Your organization administrators have been notified to renew the contract prior to the end date.`,
      status: 'SENT',
      sentAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    },
    {
      id: 'email-log-2',
      tenantId: 'tenant-acme-corp',
      tenantName: 'Acme Corporation',
      recipientUserId: 'user-tenant-admin',
      recipientEmail: 'admin@acme.com',
      recipientName: 'Acme Administrator',
      recipientRole: 'TENANT_ADMIN',
      licenseId: 'lic-3',
      licenseName: 'Adobe Creative Cloud Enterprise',
      eventType: 'EXPIRY_15',
      subject: '[AssetVault] WARNING (15 DAYS): Adobe Creative Cloud Enterprise',
      bodyText: `Hello Acme Administrator,\n\nThis is an automated compliance alert from your organization workspace Acme Corporation.\n\nSoftware license "Adobe Creative Cloud Enterprise" (Key: ADBE-CC-ENT-2026-081) will reach its contract end date on ${adobeExpDate} (14 days remaining).\n\nActive Seat Holders Affected: 2 members\nRecipient Role: Organization Administrator (TENANT_ADMIN)\nPlease renew the contract or adjust seat allocations in AssetVault before expiration.`,
      status: 'SENT',
      sentAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'email-log-3',
      tenantId: 'tenant-acme-corp',
      tenantName: 'Acme Corporation',
      recipientUserId: 'user-asset-manager',
      recipientEmail: 'manager@acme.com',
      recipientName: 'Acme Asset Manager',
      recipientRole: 'ASSET_MANAGER',
      licenseId: 'lic-3',
      licenseName: 'Adobe Creative Cloud Enterprise',
      eventType: 'EXPIRY_15',
      subject: '[AssetVault] WARNING (15 DAYS): Adobe Creative Cloud Enterprise',
      bodyText: `Hello Acme Asset Manager,\n\nThis is an automated compliance alert from your organization workspace Acme Corporation.\n\nSoftware license "Adobe Creative Cloud Enterprise" (Key: ADBE-CC-ENT-2026-081) will reach its contract end date on ${adobeExpDate} (14 days remaining).\n\nRecipient Role: Asset Manager & Seat Holder (ASSET_MANAGER)\nPlease coordinate license renewal in AssetVault.`,
      status: 'SENT',
      sentAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'email-log-4',
      tenantId: 'tenant-acme-corp',
      tenantName: 'Acme Corporation',
      recipientUserId: 'user-member',
      recipientEmail: 'member@acme.com',
      recipientName: 'Acme Team Member',
      recipientRole: 'MEMBER',
      licenseId: 'lic-1',
      licenseName: 'IntelliJ IDEA Ultimate Enterprise',
      eventType: 'SEAT_ALLOCATED',
      subject: '[AssetVault] Seat Allocated: IntelliJ IDEA Ultimate Enterprise',
      bodyText: `Hello Acme Team Member,\n\nAn active software license seat for "IntelliJ IDEA Ultimate Enterprise" (JetBrains) has been allocated to your organization account (member@acme.com) in Acme Corporation.\n\nLicense Status: ACTIVE\nContract End Date: ${new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]}\nNotes: Fullstack Core Dev seat`,
      status: 'SENT',
      sentAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
  ];

  const auditLogs = [
    {
      id: 'audit-1',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      action: 'INSERT',
      entityType: 'License',
      entityId: 'lic-1',
      details: { note: 'Provisioned initial JetBrains developer pack' },
      createdAt: new Date('2026-01-16T00:00:00Z'),
    },
  ];

  return {
    roles,
    plans,
    licenseTypes,
    tenants,
    users,
    vendors,
    categories,
    tags,
    assets,
    assetVersions,
    licenses,
    allocations,
    notifications,
    emailDeliveries,
    auditLogs,
    refreshTokens: [],
    assetTags: [],
  };
}

export class MockPrismaStore {
  public state: MockStoreState;
  private persistPath: string;
  private tmpPersistPath: string;

  constructor() {
    this.persistPath = path.resolve(process.cwd(), '.mock-store-state.json');
    this.tmpPersistPath = path.resolve(os.tmpdir(), '.mock-store-state.json');
    this.state = this.loadState();
  }

  private loadState(): MockStoreState {
    const initial = createInitialState();
    try {
      const candidatePaths = [
        this.tmpPersistPath,
        this.persistPath,
        path.resolve(process.cwd(), 'backend/.mock-store-state.json'),
        path.resolve(process.cwd(), '../.mock-store-state.json'),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.tenants)) {
            const mergeById = (baseArr: any[], savedArr: any[]) => {
              const map = new Map<string, any>();
              for (const item of baseArr) map.set(String(item.id), item);
              for (const item of savedArr) map.set(String(item.id), item);
              return Array.from(map.values());
            };
            return {
              ...initial,
              ...parsed,
              roles: initial.roles,
              plans: initial.plans,
              licenseTypes: initial.licenseTypes,
              tenants: mergeById(initial.tenants, parsed.tenants),
              users: mergeById(initial.users, parsed.users),
              vendors: mergeById(initial.vendors, parsed.vendors || []),
              assets: mergeById(initial.assets, parsed.assets || []),
              licenses: mergeById(initial.licenses, parsed.licenses || []),
              assetVersions: mergeById(initial.assetVersions, parsed.assetVersions || []),
              notifications: mergeById(initial.notifications, parsed.notifications || []),
              emailDeliveries: mergeById(initial.emailDeliveries, parsed.emailDeliveries || []),
            };
          }
        }
      }
    } catch {
      // Ignore read errors and fall back to initial state
    }
    return initial;
  }

  public saveState(): void {
    try {
      const serialized = JSON.stringify(
        this.state,
        (_k, v) => (typeof v === 'bigint' ? Number(v) : v),
        2
      );
      try {
        fs.writeFileSync(this.tmpPersistPath, serialized, 'utf-8');
      } catch {
        // Ignore tmp write errors
      }
      try {
        fs.writeFileSync(this.persistPath, serialized, 'utf-8');
      } catch {
        // Ignore read-only cwd write errors in serverless environments
      }
      try {
        const altPath = path.resolve(process.cwd(), 'backend/.mock-store-state.json');
        if (altPath !== this.persistPath && fs.existsSync(path.dirname(altPath))) {
          fs.writeFileSync(altPath, serialized, 'utf-8');
        }
      } catch {
        // Ignore altPath write errors
      }
    } catch {
      // Ignore serialization errors
    }
  }

  public normalizeWriteData(data: any): any {
    if (!data || typeof data !== 'object') return {};
    const normalized: any = { ...data };
    const relationKeys = ['tenant', 'role', 'plan', 'vendor', 'category', 'asset', 'license', 'licenseType', 'user', 'owner'];
    for (const rel of relationKeys) {
      if (normalized[rel] && typeof normalized[rel] === 'object') {
        if (normalized[rel].connect?.id !== undefined) {
          const fk = rel === 'owner' ? 'ownerId' : `${rel}Id`;
          normalized[fk] = normalized[rel].connect.id;
        } else if (normalized[rel].connect?.name !== undefined && rel === 'role') {
          const matchedRole = this.state.roles.find((r) => r.name === normalized[rel].connect.name);
          if (matchedRole) normalized.roleId = matchedRole.id;
        }
        delete normalized[rel];
      }
    }
    return normalized;
  }

  public getCollection(modelName: string): any[] {
    const key = modelName.toLowerCase();
    switch (key) {
      case 'role':
        return this.state.roles;
      case 'plan':
        return this.state.plans;
      case 'licensetype':
        return this.state.licenseTypes;
      case 'tenant':
        return this.state.tenants;
      case 'user':
        return this.state.users;
      case 'vendor':
        return this.state.vendors;
      case 'category':
        return this.state.categories;
      case 'tag':
        return this.state.tags;
      case 'asset':
        return this.state.assets;
      case 'assetversion':
        return this.state.assetVersions;
      case 'license':
        return this.state.licenses;
      case 'allocation':
      case 'licenseallocation':
        return this.state.allocations;
      case 'notification':
        return this.state.notifications;
      case 'emaildelivery':
      case 'emaildeliveries':
        return this.state.emailDeliveries;
      case 'auditlog':
        return this.state.auditLogs;
      case 'refreshtoken':
        return this.state.refreshTokens;
      default:
        if (!(this.state as any)[key]) {
          (this.state as any)[key] = [];
        }
        return (this.state as any)[key];
    }
  }

  public matches(item: any, where?: any): boolean {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (key === 'AND') {
        if (Array.isArray(value)) {
          if (!value.every((w) => this.matches(item, w))) return false;
        } else if (!this.matches(item, value)) return false;
      } else if (key === 'OR') {
        if (Array.isArray(value)) {
          if (!value.some((w) => this.matches(item, w))) return false;
        } else if (!this.matches(item, value)) return false;
      } else if (key === 'NOT') {
        if (this.matches(item, value)) return false;
      } else if (key === 'role' && value && typeof value === 'object' && 'name' in (value as any)) {
        const userRole = this.state.roles.find((r) => r.id === item.roleId);
        if (!userRole || userRole.name !== (value as any).name) return false;
      } else if (key === 'assetId_versionNo' && value && typeof value === 'object') {
        const itemVer = item.versionNo ?? (parseInt(String(item.versionNumber || '1'), 10) || 1);
        if (item.assetId !== (value as any).assetId || itemVer !== (value as any).versionNo) return false;
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        const valObj = value as any;
        if ('equals' in valObj) {
          if (item[key] !== valObj.equals) return false;
        } else if ('in' in valObj) {
          if (!Array.isArray(valObj.in) || !valObj.in.includes(item[key])) return false;
        } else if ('notIn' in valObj) {
          if (Array.isArray(valObj.notIn) && valObj.notIn.includes(item[key])) return false;
        } else if ('contains' in valObj) {
          const itemVal = String(item[key] || '').toLowerCase();
          const search = String(valObj.contains || '').toLowerCase();
          if (!itemVal.includes(search)) return false;
        } else if ('startsWith' in valObj) {
          const itemVal = String(item[key] || '').toLowerCase();
          const search = String(valObj.startsWith || '').toLowerCase();
          if (!itemVal.startsWith(search)) return false;
        } else if ('endsWith' in valObj) {
          const itemVal = String(item[key] || '').toLowerCase();
          const search = String(valObj.endsWith || '').toLowerCase();
          if (!itemVal.endsWith(search)) return false;
        } else if ('gte' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.gte instanceof Date || typeof valObj.gte === 'string' ? new Date(valObj.gte).getTime() : valObj.gte;
          if (a < b) return false;
        } else if ('lte' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.lte instanceof Date || typeof valObj.lte === 'string' ? new Date(valObj.lte).getTime() : valObj.lte;
          if (a > b) return false;
        } else if ('gt' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.gt instanceof Date || typeof valObj.gt === 'string' ? new Date(valObj.gt).getTime() : valObj.gt;
          if (a <= b) return false;
        } else if ('lt' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.lt instanceof Date || typeof valObj.lt === 'string' ? new Date(valObj.lt).getTime() : valObj.lt;
          if (a >= b) return false;
        } else if ('not' in valObj) {
          if (valObj.not === null) {
            if (item[key] === null || item[key] === undefined) return false;
          } else if (item[key] === valObj.not) {
            return false;
          }
        } else {
          for (const [subKey, subVal] of Object.entries(valObj)) {
            if (subVal !== undefined) {
              if (subKey === 'versionNo') {
                const itemVer = item.versionNo ?? (parseInt(String(item.versionNumber || '1'), 10) || 1);
                if (itemVer !== subVal) return false;
              } else if (item[subKey] !== subVal) {
                return false;
              }
            }
          }
        }
      } else {
        if (value === null) {
          if (item[key] !== null && item[key] !== undefined) return false;
        } else if (key === 'email' && typeof value === 'string') {
          if (String(item[key] || '').toLowerCase() !== value.toLowerCase()) return false;
        } else {
          if (item[key] !== value) return false;
        }
      }
    }
    return true;
  }

  public populateRelations(modelName: string, item: any, _includeOrSelect?: any): any {
    if (!item) return item;
    const cloned = { ...item };
    const lowerModel = modelName.toLowerCase();

    if (lowerModel === 'user') {
      cloned.role =
        this.state.roles.find((r) => r.id === item.roleId) ||
        (item.role && typeof item.role === 'object' && item.role.name ? item.role : null) ||
        this.state.roles.find((r) => r.name === 'TENANT_ADMIN') ||
        null;

      const tenant = this.state.tenants.find((t) => t.id === item.tenantId) || null;
      if (tenant) {
        cloned.tenant = {
          ...tenant,
          plan: this.state.plans.find((p) => p.id === tenant.planId) || this.state.plans[0] || null,
        };
      } else {
        cloned.tenant = null;
      }
    } else if (lowerModel === 'refreshtoken') {
      const rawUser = this.state.users.find((u) => u.id === item.userId) || null;
      cloned.user = rawUser ? this.populateRelations('user', rawUser) : null;
      cloned.revokedAt = item.revokedAt ? new Date(item.revokedAt) : null;
      cloned.expiresAt = item.expiresAt ? new Date(item.expiresAt) : new Date(Date.now() + 7 * 86400000);
      cloned.createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    } else if (lowerModel === 'tenant') {
      cloned.plan = this.state.plans.find((p) => p.id === item.planId) || this.state.plans[0] || null;
      cloned.users = this.state.users.filter((u) => u.tenantId === item.id);
      cloned.vendors = this.state.vendors.filter((v) => v.tenantId === item.id);
      cloned.assets = this.state.assets.filter((a) => a.tenantId === item.id);
      cloned.licenses = this.state.licenses.filter((l) => l.tenantId === item.id);
    } else if (lowerModel === 'category') {
      cloned.parent = item.parentId ? this.state.categories.find((c) => c.id === item.parentId) || null : null;
      cloned.children = this.state.categories.filter((c) => c.parentId === item.id);
      cloned._count = {
        assets: this.state.assets.filter((a) => a.categoryId === item.id && !a.deletedAt).length,
        children: cloned.children.length,
      };
    } else if (lowerModel === 'vendor') {
      cloned.contactEmail = item.contactEmail || item.supportEmail || null;
      cloned.supportEmail = item.supportEmail || item.contactEmail || null;
      cloned._count = {
        licenses: this.state.licenses.filter((l) => l.vendorId === item.id && !l.deletedAt).length,
      };
    } else if (lowerModel === 'tag') {
      cloned.color = item.color || '#6366f1';
      const assetTags = (this.state as any).assetTags || (this.state as any).assettag || [];
      cloned._count = {
        assetTags: assetTags.filter((at: any) => at.tagId === item.id).length,
      };
    } else if (lowerModel === 'assetversion') {
      cloned.versionNo = item.versionNo ?? (parseInt(String(item.versionNumber || '1'), 10) || 1);
      cloned.fileUrl = item.fileUrl || item.storageUrl || 'https://storage.assetvault.io/files/release.tar.gz';
      cloned.fileSizeBytes = Number(item.fileSizeBytes ?? item.fileSize ?? 1048576);
      cloned.checksumSha256 =
        item.checksumSha256 ||
        item.checksum ||
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      cloned.changeNotes = item.changeNotes ?? item.changelog ?? null;
      cloned.uploader = this.state.users.find((u) => u.id === item.uploadedBy) || null;
    } else if (lowerModel === 'assettag') {
      cloned.tag = this.state.tags.find((t) => t.id === item.tagId) || null;
      cloned.asset = this.state.assets.find((a) => a.id === item.assetId) || null;
    } else if (lowerModel === 'assetlicense') {
      const rawAsset = this.state.assets.find((a) => a.id === item.assetId) || null;
      cloned.asset = rawAsset
        ? {
            ...rawAsset,
            assetCode: rawAsset.assetCode || rawAsset.code || 'AST-100',
            assetType: rawAsset.assetType || rawAsset.type || 'SOFTWARE',
            category: this.state.categories.find((c) => c.id === rawAsset.categoryId) || null,
            owner: this.state.users.find((u) => u.id === rawAsset.ownerId) || null,
          }
        : null;
      const rawLic = this.state.licenses.find((l) => l.id === item.licenseId) || null;
      cloned.license = rawLic
        ? {
            ...rawLic,
            name: rawLic.name || rawLic.licenseKey || 'Enterprise License',
            vendor: this.state.vendors.find((v) => v.id === rawLic.vendorId) || null,
            licenseType:
              this.state.licenseTypes.find((lt) => lt.id === rawLic.licenseTypeId) ||
              this.state.licenseTypes[2] ||
              null,
          }
        : null;
    } else if (lowerModel === 'assetaccesslog') {
      cloned.accessedAt = item.accessedAt || item.createdAt || new Date();
      cloned.user = this.state.users.find((u) => u.id === item.userId) || null;
      cloned.asset = this.state.assets.find((a) => a.id === item.assetId) || null;
    } else if (lowerModel === 'asset') {
      cloned.assetCode = item.assetCode || item.code || 'AST-100';
      cloned.assetType = item.assetType || item.type || 'SOFTWARE';
      cloned.type = item.type || item.assetType || 'SOFTWARE';
      cloned.vendor = this.state.vendors.find((v) => v.id === item.vendorId) || null;
      cloned.category = this.state.categories.find((c) => c.id === item.categoryId) || null;
      cloned.owner =
        this.state.users.find((u) => u.id === item.ownerId) ||
        this.state.users.find((u) => u.tenantId === item.tenantId) ||
        null;
      cloned.versions = this.state.assetVersions
        .filter((v) => v.assetId === item.id)
        .map((v) => this.populateRelations('assetVersion', v));
      cloned.licenses = this.state.licenses.filter((l) => l.assetId === item.id);
      const rawAssetTags = [
        ...((this.state as any).assetTags || []),
        ...((this.state as any).assettag || []),
      ].filter((at: any) => at.assetId === item.id);
      cloned.assetTags = rawAssetTags
        .map((at: any) => this.populateRelations('assetTag', at))
        .filter((at: any) => at.tag);
      const explicitAssetLicenses = ((this.state as any).assetlicense || [])
        .filter((al: any) => al.assetId === item.id)
        .map((al: any) => this.populateRelations('assetLicense', al))
        .filter((al: any) => al.license);
      const directLicenses = this.state.licenses
        .filter((l) => l.assetId === item.id && !explicitAssetLicenses.some((al: any) => al.licenseId === l.id))
        .map((l) =>
          this.populateRelations('assetLicense', {
            id: `al-${item.id}-${l.id}`,
            assetId: item.id,
            licenseId: l.id,
          })
        )
        .filter((al: any) => al.license);
      cloned.assetLicenses = [...explicitAssetLicenses, ...directLicenses];
    } else if (lowerModel === 'license') {
      cloned.name = item.name || item.licenseKey || 'Enterprise License';
      cloned.startDate = item.startDate || item.createdAt || new Date();
      cloned.endDate =
        item.endDate !== undefined ? item.endDate : item.expiresAt !== undefined ? item.expiresAt : null;
      cloned.currency = item.currency || 'USD';
      cloned.cost = item.cost ?? 0;
      cloned.asset = this.state.assets.find((a) => a.id === item.assetId) || null;
      cloned.vendor = this.state.vendors.find((v) => v.id === item.vendorId) || {
        id: 'vendor-default',
        name: 'Enterprise Vendor',
        contactEmail: 'support@vendor.com',
        website: 'https://vendor.com',
      };
      cloned.licenseType =
        this.state.licenseTypes.find((lt) => lt.id === item.licenseTypeId) ||
        this.state.licenseTypes[2] || {
          id: 3,
          name: 'SEAT_BASED',
          isSeatBased: true,
          isExpirable: true,
        };
      cloned.allocations = this.state.allocations
        .filter((al) => al.licenseId === item.id && al.status === 'ACTIVE')
        .map((al) => ({
          ...al,
          user: this.state.users.find((u) => u.id === al.userId) || {
            id: al.userId,
            fullName: 'Team Member',
            email: 'member@workspace.io',
          },
        }));
      cloned.usedSeats = item.usedSeats ?? item.allocatedSeats ?? cloned.allocations.length;
      const explicitAssetLicenses = ((this.state as any).assetlicense || [])
        .filter((al: any) => al.licenseId === item.id)
        .map((al: any) => this.populateRelations('assetLicense', al))
        .filter((al: any) => al.asset);
      cloned.assetLicenses = explicitAssetLicenses;
      const rawRenewals = ((this.state as any).licenserenewal || []).filter(
        (r: any) => r.licenseId === item.id
      );
      cloned.renewals = rawRenewals.map((r: any) => this.populateRelations('licenseRenewal', r));
      cloned._count = {
        allocations: cloned.allocations.length,
        assetLicenses: explicitAssetLicenses.length,
      };
    } else if (lowerModel === 'licenserenewal') {
      cloned.renewedAt = item.renewedAt || item.createdAt || new Date();
      cloned.renewer =
        this.state.users.find((u) => u.id === item.performedBy || u.id === item.renewedBy) || null;
    } else if (lowerModel === 'auditlog') {
      cloned.performedAt = item.performedAt
        ? new Date(item.performedAt)
        : item.createdAt
        ? new Date(item.createdAt)
        : new Date();
      cloned.tableName = item.tableName || item.entityType || 'system';
      cloned.recordId = item.recordId || item.entityId || String(item.id);
      cloned.user = this.state.users.find((u) => u.id === item.userId) || null;
    } else if (lowerModel === 'allocation' || lowerModel === 'licenseallocation') {
      const lic = this.state.licenses.find((l) => l.id === item.licenseId);
      if (lic) {
        cloned.license = {
          ...lic,
          name: lic.name || lic.licenseKey || 'Enterprise License',
          asset: this.state.assets.find((a) => a.id === lic.assetId) || null,
          vendor: this.state.vendors.find((v) => v.id === lic.vendorId) || null,
        };
      } else {
        cloned.license = null;
      }
      cloned.user = this.state.users.find((u) => u.id === item.userId) || null;
    }

    return cloned;
  }
}

export const mockStore = new MockPrismaStore();

export function createMockModelClient(modelName: string): any {
  return {
    async findUnique(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const item = collection.find((i) => mockStore.matches(i, args.where));
      return item ? mockStore.populateRelations(modelName, item, args.include || args.select) : null;
    },

    async findFirst(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const item = collection.find((i) => mockStore.matches(i, args.where));
      return item ? mockStore.populateRelations(modelName, item, args.include || args.select) : null;
    },

    async findFirstOrThrow(args: any = {}) {
      const res = await this.findFirst(args);
      if (!res) throw new Error(`${modelName} not found`);
      return res;
    },

    async findUniqueOrThrow(args: any = {}) {
      const res = await this.findUnique(args);
      if (!res) throw new Error(`${modelName} not found`);
      return res;
    },

    async findMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      let items = collection.filter((i) => mockStore.matches(i, args.where));

      if (args.orderBy) {
        const orderKey = Object.keys(args.orderBy)[0];
        if (orderKey) {
          const dir = args.orderBy[orderKey];
          items.sort((a, b) => {
            const va = a[orderKey];
            const vb = b[orderKey];
            if (va < vb) return dir === 'desc' ? 1 : -1;
            if (va > vb) return dir === 'desc' ? -1 : 1;
            return 0;
          });
        }
      }

      if (typeof args.skip === 'number') {
        items = items.slice(args.skip);
      }
      if (typeof args.take === 'number') {
        items = items.slice(0, args.take);
      }

      return items.map((i) => mockStore.populateRelations(modelName, i, args.include || args.select));
    },

    async count(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      return collection.filter((i) => mockStore.matches(i, args.where)).length;
    },

    async aggregate(args: any = {}) {
      const count = await this.count(args);
      return {
        _count: { _all: count, id: count },
        _sum: { cost: 3500 },
        _avg: { cost: 875 },
      };
    },

    async groupBy(_args: any = {}) {
      return [];
    },

    async create(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const normalizedData = mockStore.normalizeWriteData(args.data);
      const newItem = {
        id:
          normalizedData?.id ||
          (modelName.toLowerCase() === 'auditlog'
            ? String(Date.now() + Math.floor(Math.random() * 100000))
            : crypto.randomUUID()),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(modelName.toLowerCase() === 'refreshtoken' ? { revokedAt: null } : {}),
        ...(modelName.toLowerCase() === 'auditlog' ? { performedAt: new Date() } : {}),
        ...normalizedData,
      };
      collection.push(newItem);
      mockStore.saveState();
      return mockStore.populateRelations(modelName, newItem, args.include || args.select);
    },

    async update(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const idx = collection.findIndex((i) => mockStore.matches(i, args.where));
      if (idx === -1) {
        throw new Error(`${modelName} not found for update`);
      }
      const normalizedData = mockStore.normalizeWriteData(args.data);
      collection[idx] = {
        ...collection[idx],
        ...normalizedData,
        updatedAt: new Date(),
      };
      mockStore.saveState();
      return mockStore.populateRelations(modelName, collection[idx], args.include || args.select);
    },

    async upsert(args: any = {}) {
      const existing = await this.findFirst({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update, include: args.include, select: args.select });
      }
      return this.create({
        data: { ...(args.where || {}), ...(args.create || {}) },
        include: args.include,
        select: args.select,
      });
    },

    async delete(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const idx = collection.findIndex((i) => mockStore.matches(i, args.where));
      if (idx === -1) {
        throw new Error(`${modelName} not found for deletion`);
      }
      const [removed] = collection.splice(idx, 1);
      mockStore.saveState();
      return removed;
    },

    async updateMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const normalizedData = mockStore.normalizeWriteData(args.data);
      let count = 0;
      for (let i = 0; i < collection.length; i++) {
        if (mockStore.matches(collection[i], args.where)) {
          collection[i] = { ...collection[i], ...normalizedData, updatedAt: new Date() };
          count++;
        }
      }
      mockStore.saveState();
      return { count };
    },

    async deleteMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      let count = 0;
      for (let i = collection.length - 1; i >= 0; i--) {
        if (mockStore.matches(collection[i], args.where)) {
          collection.splice(i, 1);
          count++;
        }
      }
      mockStore.saveState();
      return { count };
    },
  };
}

function extractSqlAndValues(queryArg: any, restArgs: any[]): { sqlText: string; values: any[] } {
  if (typeof queryArg === 'string') {
    return { sqlText: queryArg, values: restArgs };
  }
  if (Array.isArray(queryArg)) {
    return { sqlText: queryArg.join(' '), values: restArgs };
  }
  if (queryArg && typeof queryArg === 'object') {
    const sqlText = Array.isArray(queryArg.strings)
      ? queryArg.strings.join(' ')
      : String(queryArg.text || queryArg.sql || '');
    const values =
      Array.isArray(queryArg.values) && queryArg.values.length > 0
        ? queryArg.values
        : restArgs;
    return { sqlText, values };
  }
  return { sqlText: String(queryArg || ''), values: restArgs };
}

export function createMockPrismaClient(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'then') return undefined;
      if (prop === '$connect') return async () => {};
      if (prop === '$disconnect') return async () => {};
      if (prop === '$transaction') {
        return async (fnOrArray: any) => {
          if (typeof fnOrArray === 'function') {
            return fnOrArray(createMockPrismaClient());
          }
          if (Array.isArray(fnOrArray)) {
            return Promise.all(fnOrArray);
          }
          return fnOrArray;
        };
      }
      if (prop === '$queryRaw') {
        return async (...rawArgs: any[]) => {
          const { sqlText, values } = extractSqlAndValues(rawArgs[0], rawArgs.slice(1));

          if (sqlText.includes('fn_tenant_dashboard_stats')) {
            const totalAssets = mockStore.state.assets.length;
            const totalLicenses = mockStore.state.licenses.length;
            const totalSeats = mockStore.state.licenses.reduce((s, l) => s + (l.totalSeats || 0), 0);
            const allocatedSeats = mockStore.state.licenses.reduce((s, l) => s + (l.allocatedSeats || 0), 0);
            const totalSpend = mockStore.state.licenses.reduce((s, l) => s + Number(l.cost || 0), 0);
            return [
              {
                fn_tenant_dashboard_stats: {
                  total_assets: totalAssets,
                  asset_count: totalAssets,
                  total_licenses: totalLicenses,
                  license_count: totalLicenses,
                  user_count: mockStore.state.users.length,
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
            ];
          }

          if (sqlText.includes('v_asset_catalog')) {
            if (sqlText.toLowerCase().includes('count(')) {
              const total = mockStore.state.assets.length;
              return [
                {
                  total,
                  count: total,
                  total_assets: total,
                  compliant_assets: total,
                  expired_license_assets: 0,
                  unlicensed_assets: 0,
                },
              ];
            }
            if (sqlText.includes('UNLICENSED')) {
              return [];
            }
            return mockStore.state.assets.map((a, idx) => ({
              asset_id: a.id,
              tenant_id: a.tenantId,
              asset_code: `AST-${100 + idx}`,
              asset_name: a.name,
              description: a.description,
              asset_type: a.type,
              asset_status: a.status,
              category_name: 'Developer Tools',
              owner_name: 'Acme Administrator',
              owner_email: 'admin@acme.com',
              latest_version_no: 1,
              total_versions: 1,
              tags: ['Engineering', 'Production'],
              covering_licenses_count: 1,
              compliance_status: 'COMPLIANT',
              created_at: a.createdAt,
              updated_at: a.updatedAt,
            }));
          }

          if (sqlText.includes('sp_allocate_license_seat')) {
            const [licenseId, userId, allocatedBy] = values;
            const lic = mockStore.state.licenses.find((l) => l.id === licenseId);
            if (!lic) {
              throw new Error('License not found');
            }
            const activeForLicense = mockStore.state.allocations.filter(
              (a) => a.licenseId === licenseId && a.status === 'ACTIVE'
            );
            const currentUsed = Math.max(Number(lic.allocatedSeats ?? lic.usedSeats ?? 0), activeForLicense.length);
            if (currentUsed >= Number(lic.totalSeats || 1)) {
              throw new Error('License seats exhausted');
            }
            const existingActive = activeForLicense.find((a) => a.userId === userId);
            if (existingActive) {
              throw new Error('User already holds an active seat for this license');
            }
            const newAlloc = {
              id: crypto.randomUUID(),
              tenantId: lic.tenantId || 'tenant-acme-corp',
              licenseId,
              userId,
              allocatedBy: allocatedBy || userId,
              status: 'ACTIVE',
              allocatedAt: new Date(),
              revokedAt: null,
              notes: 'Allocated via sp_allocate_license_seat',
            };
            mockStore.state.allocations.unshift(newAlloc);
            const updatedActiveCount = mockStore.state.allocations.filter(
              (a) => a.licenseId === licenseId && a.status === 'ACTIVE'
            ).length;
            lic.allocatedSeats = Math.max(currentUsed + 1, updatedActiveCount);
            lic.usedSeats = lic.allocatedSeats;
            mockStore.saveState();
            return [{ p_allocation_id: newAlloc.id }];
          }

          if (sqlText.includes('sp_release_license_seat')) {
            const [allocationId, revokedBy, reason] = values;
            const alloc = mockStore.state.allocations.find((a) => a.id === allocationId);
            if (alloc && alloc.status === 'ACTIVE') {
              alloc.status = 'REVOKED';
              alloc.revokedAt = new Date();
              alloc.revokedBy = revokedBy || null;
              alloc.revokeReason = reason || 'Administrative seat release';
              const lic = mockStore.state.licenses.find((l) => l.id === alloc.licenseId);
              if (lic) {
                const remainingActive = mockStore.state.allocations.filter(
                  (a) => a.licenseId === lic.id && a.status === 'ACTIVE'
                ).length;
                lic.allocatedSeats = remainingActive;
                lic.usedSeats = remainingActive;
              }
              mockStore.saveState();
            }
            return [{ success: true }];
          }

          if (sqlText.includes('sp_renew_license')) {
            const [licenseId, newEndDate, cost, performedBy, notes] = values;
            const lic = mockStore.state.licenses.find((l) => l.id === licenseId);
            const renewalId = crypto.randomUUID();
            if (lic) {
              const previousEndDate = lic.endDate || lic.expiresAt || new Date();
              lic.endDate = new Date(newEndDate);
              lic.expiresAt = new Date(newEndDate);
              if (cost !== undefined && cost !== null) {
                lic.cost = Number(cost);
              }
              lic.status = 'ACTIVE';
              const renewalCol = mockStore.getCollection('licenseRenewal');
              renewalCol.unshift({
                id: renewalId,
                licenseId,
                previousEndDate,
                newEndDate: new Date(newEndDate),
                cost: Number(cost ?? lic.cost ?? 0),
                performedBy: performedBy || null,
                notes: notes || null,
                renewedAt: new Date(),
              });
              mockStore.saveState();
            }
            return [{ p_renewal_id: renewalId }];
          }

          if (sqlText.includes('v_license_utilization')) {
            const mapped = mockStore.state.licenses.map((l) => {
              const vendor = mockStore.state.vendors.find((v) => v.id === l.vendorId);
              const licType = mockStore.state.licenseTypes.find((lt) => lt.id === l.licenseTypeId);
              const totalSeats = Number(l.totalSeats || 1);
              const activeAllocsForLic = mockStore.state.allocations.filter(
                (a) => a.licenseId === l.id && a.status === 'ACTIVE'
              ).length;
              const usedSeats = Math.max(Number(l.allocatedSeats ?? l.usedSeats ?? 0), activeAllocsForLic);
              const endDate = l.endDate ?? l.expiresAt ?? null;
              const daysToExpiry = endDate
                ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              return {
                license_id: l.id,
                tenant_id: l.tenantId,
                vendor_id: l.vendorId,
                license_type_id: l.licenseTypeId || 3,
                license_name: l.name || l.licenseKey,
                license_key: l.licenseKey ? `••••••••-${String(l.licenseKey).slice(-4)}` : '••••••••-KEY',
                vendor_name: vendor?.name || 'Enterprise Vendor',
                license_type: licType?.name || l.type || 'SEAT_BASED',
                total_seats: totalSeats,
                used_seats: usedSeats,
                available_seats: Math.max(0, totalSeats - usedSeats),
                utilization_pct: Math.round((usedSeats / Math.max(1, totalSeats)) * 100),
                days_to_expiry: daysToExpiry,
                status: l.status || 'ACTIVE',
                start_date: l.startDate || l.createdAt,
                end_date: endDate,
                cost: l.cost ?? 0,
                currency: l.currency || 'USD',
              };
            });

            if (sqlText.toLowerCase().includes('count(')) {
              const total = mapped.length;
              const exhausted = mapped.filter((m) => m.available_seats <= 0).length;
              const overAllocated = mapped.filter((m) => m.used_seats > m.total_seats).length;
              return [
                {
                  total,
                  count: total,
                  total_licenses: total,
                  exhausted_licenses: exhausted,
                  over_allocated_licenses: overAllocated,
                },
              ];
            }
            if (sqlText.includes('available_seats <= 0')) {
              return mapped.filter((m) => m.available_seats <= 0);
            }
            return mapped;
          }

          if (sqlText.includes('v_expiring_licenses')) {
            const mapped = mockStore.state.licenses
              .filter((l) => l.expiresAt || l.endDate)
              .map((l) => {
                const expDate = l.endDate || l.expiresAt;
                const daysLeft = Math.max(
                  1,
                  Math.round((new Date(expDate as any).getTime() - Date.now()) / (24 * 3600 * 1000))
                );
                return {
                  license_id: l.id,
                  tenant_id: l.tenantId,
                  license_name: l.name || l.licenseKey,
                  vendor_name: 'Enterprise Vendor',
                  total_seats: l.totalSeats,
                  active_allocations: l.allocatedSeats ?? 0,
                  start_date: l.startDate || l.createdAt,
                  end_date: expDate,
                  days_left: daysLeft,
                  urgency_bucket: daysLeft <= 7 ? 'CRITICAL' : daysLeft <= 15 ? 'WARNING' : 'NOTICE',
                  cost: l.cost,
                  currency: l.currency || 'USD',
                  auto_renew: l.autoRenew,
                };
              });

            if (sqlText.toLowerCase().includes('count(')) {
              return [
                {
                  total: mapped.length,
                  count: mapped.length,
                  total_expiring: mapped.length,
                  critical_expiring: mapped.filter((m) => m.urgency_bucket === 'CRITICAL').length,
                  warning_expiring: mapped.filter((m) => m.urgency_bucket === 'WARNING').length,
                  notice_expiring: mapped.filter((m) => m.urgency_bucket === 'NOTICE').length,
                },
              ];
            }
            return mapped;
          }

          if (sqlText.includes('monthly_costs')) {
            return [
              { month_year: '2026-08', monthly_spend: 1200, running_total_spend: 1200 },
              { month_year: '2026-09', monthly_spend: 1150, running_total_spend: 2350 },
              { month_year: '2026-10', monthly_spend: 1248, running_total_spend: 3598 },
            ];
          }

          if (sqlText.includes('asset_downloads')) {
            return mockStore.state.assets.slice(0, 10).map((a, idx) => ({
              asset_id: a.id,
              asset_name: a.name,
              asset_code: a.assetCode || `AST-${100 + idx}`,
              download_count: Math.max(1, 15 - idx * 2),
              rank: idx + 1,
            }));
          }

          if (sqlText.includes('mv_monthly_access_stats')) {
            return [
              {
                month_year: '2026-08',
                download_count: 14,
                checkout_count: 8,
                view_count: 42,
                checkin_count: 7,
                total_access_events: 71,
                active_accessing_users: 4,
                distinct_assets_accessed: 5,
              },
              {
                month_year: '2026-09',
                download_count: 19,
                checkout_count: 11,
                view_count: 58,
                checkin_count: 10,
                total_access_events: 98,
                active_accessing_users: 5,
                distinct_assets_accessed: 6,
              },
              {
                month_year: '2026-10',
                download_count: 24,
                checkout_count: 15,
                view_count: 73,
                checkin_count: 14,
                total_access_events: 126,
                active_accessing_users: 6,
                distinct_assets_accessed: 6,
              },
            ];
          }

          if (sqlText.includes('v_vendor_spend')) {
            return mockStore.state.vendors.map((v) => ({
              vendor_id: v.id,
              vendor_name: v.name,
              contact_email: v.supportEmail || v.contactEmail,
              license_count: 1,
              total_initial_cost: 750,
              total_renewal_cost: 0,
              grand_total_spend: 750,
              total_seats_contracted: 35,
              avg_cost_per_seat: 21.43,
            }));
          }

          if (sqlText.includes('v_tenant_summary')) {
            return mockStore.state.tenants.map((t) => {
              const plan = mockStore.state.plans.find((p) => p.id === t.planId) || mockStore.state.plans[0];
              return {
                tenant_id: t.id,
                tenant_name: t.name,
                slug: t.slug,
                plan_name: plan?.name || 'Enterprise',
                tenant_status: t.status || 'ACTIVE',
                user_count: mockStore.state.users.filter((u) => u.tenantId === t.id).length,
                max_users: plan?.maxUsers || 250,
                asset_count: mockStore.state.assets.filter((a) => a.tenantId === t.id).length,
                max_assets: plan?.maxAssets || 5000,
                license_count: mockStore.state.licenses.filter((l) => l.tenantId === t.id).length,
                active_seats_count: 6,
                total_license_spend: 3598,
                onboarded_at: t.createdAt,
              };
            });
          }

          if (sqlText.includes('SELECT id, name FROM tenants')) {
            return mockStore.state.tenants
              .filter((t) => t.status === 'ACTIVE' || t.status === 'TRIAL')
              .map((t) => ({ id: t.id, name: t.name }));
          }

          if (sqlText.includes('fn_generate_expiry_notifications')) {
            const targetTenantId = values[0] || 'tenant-acme-corp';
            const lookaheadDays = Number(values[1] || 30);

            const tenantLicenses = mockStore.state.licenses.filter(
              (l) =>
                l.tenantId === targetTenantId &&
                l.status !== 'CANCELLED' &&
                !l.deletedAt &&
                (l.endDate || l.expiresAt)
            );

            let createdCount = 0;

            for (const lic of tenantLicenses) {
              const rawEnd = lic.endDate || lic.expiresAt;
              if (!rawEnd) continue;
              const endDateObj = new Date(rawEnd);
              const daysLeft = Math.ceil((endDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              if (daysLeft > lookaheadDays) continue;

              const notifType =
                daysLeft <= 0
                  ? 'EXPIRED'
                  : daysLeft <= 7
                  ? 'EXPIRY_7'
                  : daysLeft <= 15
                  ? 'EXPIRY_15'
                  : 'EXPIRY_30';

              const licenseDisplayName = lic.name || lic.licenseKey || 'Enterprise License';
              const expDateStr = endDateObj.toISOString().split('T')[0];

              // Find all active seat holders for this license + organization admins (TENANT_ADMIN=2, ASSET_MANAGER=3)
              const activeSeatHolderIds = new Set(
                mockStore.state.allocations
                  .filter((a) => a.licenseId === lic.id && a.status === 'ACTIVE')
                  .map((a) => a.userId)
              );

              const targetUsers = mockStore.state.users.filter(
                (u) =>
                  u.tenantId === targetTenantId &&
                  u.isActive !== false &&
                  (u.roleId === 2 || u.roleId === 3 || activeSeatHolderIds.has(u.id))
              );

              for (const recipient of targetUsers) {
                const isSeatHolder = activeSeatHolderIds.has(recipient.id);
                const roleLabel = isSeatHolder ? 'assigned seat holder' : 'organization admin';
                const title =
                  notifType === 'EXPIRED'
                    ? `EXPIRED: ${licenseDisplayName}`
                    : `${licenseDisplayName} Expires in ${daysLeft} Days`;
                const message =
                  notifType === 'EXPIRED'
                    ? `Automated email alert queued for ${recipient.email} (${roleLabel}): License "${licenseDisplayName}" expired on ${expDateStr}.`
                    : `Automated email alert queued for ${recipient.email} (${roleLabel}): License "${licenseDisplayName}" expires on ${expDateStr} (${daysLeft} days left).`;

                // Create a fresh notification if no unread pending notification exists for this license + user + type
                const existingPending = mockStore.state.notifications.find(
                  (n) =>
                    n.tenantId === targetTenantId &&
                    n.userId === recipient.id &&
                    n.licenseId === lic.id &&
                    n.type === notifType &&
                    n.emailSent === false
                );

                if (!existingPending) {
                  mockStore.state.notifications.unshift({
                    id: crypto.randomUUID(),
                    tenantId: targetTenantId,
                    userId: recipient.id,
                    licenseId: lic.id,
                    type: notifType,
                    title,
                    message,
                    isRead: false,
                    emailSent: false,
                    recipientEmail: recipient.email,
                    recipientName: recipient.fullName,
                    createdAt: new Date(),
                  });
                  createdCount++;
                }
              }
            }

            if (createdCount > 0) {
              mockStore.saveState();
            }

            return [{ count: createdCount, created_count: createdCount }];
          }

          if (sqlText.includes('FROM notifications n') && sqlText.includes('email_sent = FALSE')) {
            return mockStore.state.notifications
              .filter((n) => !n.emailSent)
              .map((n) => {
                const u = mockStore.state.users.find((usr) => usr.id === n.userId);
                const t = mockStore.state.tenants.find((ten) => ten.id === n.tenantId);
                const l = mockStore.state.licenses.find((lic) => lic.id === n.licenseId);
                return {
                  id: n.id,
                  type: n.type,
                  message: n.message,
                  created_at: n.createdAt,
                  email: u?.email || n.recipientEmail || '',
                  full_name: u?.fullName || n.recipientName || 'Member',
                  tenant_name: t?.name || 'Organization',
                  license_name: l?.name || l?.licenseKey || 'Software License',
                  end_date: l?.endDate || l?.expiresAt || null,
                };
              });
          }

          if (sqlText.includes('failed_login_attempts')) {
            const key = values.find((v: any) => typeof v === 'string' && v.includes('#')) || values[0];
            if (!key) return [];
            const list = ((mockStore.state as any).failedLoginAttempts = (mockStore.state as any).failedLoginAttempts || []);
            const found = list.find((r: any) => r.key === key);
            return found ? [found] : [];
          }

          if (sqlText.includes('SELECT 1')) {
            return [{ '?column?': 1, '1': 1 }];
          }

          return [];
        };
      }
      if (prop === '$executeRaw') {
        return async (...rawArgs: any[]) => {
          const { sqlText, values } = extractSqlAndValues(rawArgs[0], rawArgs.slice(1));

          if (sqlText.includes('DELETE FROM failed_login_attempts')) {
            const key = values.find((v: any) => typeof v === 'string' && v.includes('#')) || values[0];
            if (key) {
              (mockStore.state as any).failedLoginAttempts = ((mockStore.state as any).failedLoginAttempts || []).filter(
                (r: any) => r.key !== key
              );
            } else {
              (mockStore.state as any).failedLoginAttempts = [];
            }
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const { memoryFallbackMap } = require('../services/accountProtection.service');
              if (key) {
                memoryFallbackMap.delete(key);
              } else {
                memoryFallbackMap.clear();
              }
            } catch {
              // ignore
            }
            mockStore.saveState();
            return 1;
          }

          if (sqlText.includes('failed_login_attempts') && sqlText.includes('UPDATE failed_login_attempts SET locked_until')) {
            const key = values.find((v: any) => typeof v === 'string' && v.includes('#')) || values[1];
            const lockedUntil = values.find((v: any) => v instanceof Date) || new Date(Date.now() + 15 * 60 * 1000);
            const list = ((mockStore.state as any).failedLoginAttempts = (mockStore.state as any).failedLoginAttempts || []);
            const existing = list.find((r: any) => r.key === key);
            if (existing) {
              existing.locked_until = lockedUntil;
              mockStore.saveState();
            }
            return 1;
          }

          if (sqlText.includes('failed_login_attempts')) {
            const key = values.find((v: any) => typeof v === 'string' && v.includes('#')) || values[0];
            if (!key) return 1;
            const email = values.find((v: any) => typeof v === 'string' && v.includes('@')) || key.split('#')[0] || '';
            const ip = values.find((v: any) => typeof v === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(v)) || key.split('#')[1] || '127.0.0.1';
            const list = ((mockStore.state as any).failedLoginAttempts = (mockStore.state as any).failedLoginAttempts || []);
            const existing = list.find((r: any) => r.key === key);
            const now = new Date();
            if (existing) {
              existing.count = (existing.count || 0) + 1;
              existing.last_attempt_at = now;
              if (existing.count >= 5) {
                existing.locked_until = new Date(now.getTime() + 15 * 60 * 1000);
              }
            } else {
              list.push({
                key,
                email,
                ip_address: ip,
                count: 1,
                first_attempt_at: now,
                last_attempt_at: now,
                locked_until: null,
              });
            }
            mockStore.saveState();
            return 1;
          }

          if (sqlText.includes('UPDATE notifications SET email_sent = TRUE')) {
            const notifId = values[0];
            const notif = mockStore.state.notifications.find((n) => n.id === notifId);
            if (notif) {
              notif.emailSent = true;
              mockStore.saveState();
            }
            return 1;
          }

          if (sqlText.includes('sp_release_license_seat')) {
            const [allocationId, revokedBy, reason] = values;
            const alloc = mockStore.state.allocations.find((a) => a.id === allocationId);
            if (alloc && alloc.status === 'ACTIVE') {
              alloc.status = 'REVOKED';
              alloc.revokedAt = new Date();
              alloc.revokedBy = revokedBy || null;
              alloc.revokeReason = reason || 'Administrative seat release';
              const lic = mockStore.state.licenses.find((l) => l.id === alloc.licenseId);
              if (lic) {
                const remainingActive = mockStore.state.allocations.filter(
                  (a) => a.licenseId === lic.id && a.status === 'ACTIVE'
                ).length;
                lic.allocatedSeats = remainingActive;
                lic.usedSeats = remainingActive;
              }
              mockStore.saveState();
            }
          }
          return 1;
        };
      }
      if (prop === '$extends') {
        return () => createMockPrismaClient();
      }
      if (prop.startsWith('$')) {
        return async () => {};
      }
      return createMockModelClient(prop);
    },
  };

  return new Proxy({}, handler);
}

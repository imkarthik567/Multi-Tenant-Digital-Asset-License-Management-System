import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting AssetVault Database Seeding...');

  // 1. Roles
  const roles = [
    { id: 1, name: 'super_admin', description: 'Global platform administrator' },
    { id: 2, name: 'tenant_admin', description: 'Tenant organization administrator' },
    { id: 3, name: 'asset_manager', description: 'Asset and license manager' },
    { id: 4, name: 'member', description: 'Standard employee / asset consumer' },
    { id: 5, name: 'auditor', description: 'Compliance audit viewer' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { description: role.description },
      create: role,
    });
  }
  console.log('✅ Roles seeded.');

  // 2. Tenants
  const systemTenant = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'AssetVault System',
      slug: 'system',
      status: 'active',
      subscriptionTier: 'enterprise',
    },
  });

  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme-media' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Media Labs',
      slug: 'acme-media',
      status: 'active',
      subscriptionTier: 'standard',
    },
  });

  const nexusTenant = await prisma.tenant.upsert({
    where: { slug: 'nexus-tech' },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Nexus Tech Labs',
      slug: 'nexus-tech',
      status: 'active',
      subscriptionTier: 'enterprise',
    },
  });
  console.log('✅ Tenants seeded.');

  // 3. Users (Password: Password123!)
  const defaultPasswordHash = await bcrypt.hash('Password123!', 12);

  const users = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      tenantId: systemTenant.id,
      roleId: 1, // super_admin
      email: 'superadmin@assetvault.internal',
      fullName: 'Karthikeyan System Admin',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin',
    },
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      roleId: 2, // tenant_admin
      email: 'alice.admin@acme.io',
      fullName: 'Alice Vance (Tenant Admin)',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
    {
      id: 'a1111111-1111-1111-1111-111111111112',
      tenantId: acmeTenant.id,
      roleId: 3, // asset_manager
      email: 'bob.manager@acme.io',
      fullName: 'Bob Martinez (Asset Manager)',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    },
    {
      id: 'a1111111-1111-1111-1111-111111111113',
      tenantId: acmeTenant.id,
      roleId: 4, // member
      email: 'charlie.designer@acme.io',
      fullName: 'Charlie Davis (Lead Designer)',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    },
    {
      id: 'a2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      roleId: 2, // tenant_admin
      email: 'david.admin@nexus.io',
      fullName: 'David Reynolds (VP Engineering)',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222',
      tenantId: nexusTenant.id,
      roleId: 4, // member
      email: 'eva.dev@nexus.io',
      fullName: 'Eva Chen (Senior AI Researcher)',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eva',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        uq_users_tenant_email: {
          tenantId: user.tenantId,
          email: user.email,
        },
      },
      update: {},
      create: {
        id: user.id,
        tenantId: user.tenantId,
        roleId: user.roleId,
        email: user.email,
        passwordHash: defaultPasswordHash,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isActive: true,
      },
    });
  }
  console.log('✅ Users seeded.');

  // 4. Vendors
  const adobeVendor = await prisma.vendor.upsert({
    where: { uq_vendors_tenant_name: { tenantId: acmeTenant.id, name: 'Adobe Systems Inc.' } },
    update: {},
    create: {
      id: 'b1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      name: 'Adobe Systems Inc.',
      contactEmail: 'enterprisesales@adobe.com',
      contactPhone: '+1-800-833-6687',
      websiteUrl: 'https://adobe.com',
    },
  });

  const monotypeVendor = await prisma.vendor.upsert({
    where: { uq_vendors_tenant_name: { tenantId: acmeTenant.id, name: 'Monotype Imaging' } },
    update: {},
    create: {
      id: 'b1111111-1111-1111-1111-111111111112',
      tenantId: acmeTenant.id,
      name: 'Monotype Imaging',
      contactEmail: 'licensing@monotype.com',
      contactPhone: '+1-781-970-6000',
      websiteUrl: 'https://monotype.com',
    },
  });

  const jetbrainsVendor = await prisma.vendor.upsert({
    where: { uq_vendors_tenant_name: { tenantId: nexusTenant.id, name: 'JetBrains s.r.o.' } },
    update: {},
    create: {
      id: 'b2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      name: 'JetBrains s.r.o.',
      contactEmail: 'sales@jetbrains.com',
      websiteUrl: 'https://jetbrains.com',
    },
  });
  console.log('✅ Vendors seeded.');

  // 5. Categories
  const fontCategory = await prisma.category.upsert({
    where: { uq_categories_tenant_name: { tenantId: acmeTenant.id, name: 'Typography & Fonts' } },
    update: {},
    create: {
      id: 'c1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      name: 'Typography & Fonts',
      description: 'Commercial digital typefaces',
    },
  });

  const softwareCategory = await prisma.category.upsert({
    where: { uq_categories_tenant_name: { tenantId: acmeTenant.id, name: 'Creative Application Suites' } },
    update: {},
    create: {
      id: 'c1111111-1111-1111-1111-111111111112',
      tenantId: acmeTenant.id,
      name: 'Creative Application Suites',
      description: 'Design suites and visual tools',
    },
  });

  const ideCategory = await prisma.category.upsert({
    where: { uq_categories_tenant_name: { tenantId: nexusTenant.id, name: 'Developer Tools & IDEs' } },
    update: {},
    create: {
      id: 'c2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      name: 'Developer Tools & IDEs',
    },
  });
  console.log('✅ Categories seeded.');

  // 6. Tags
  const brandTag = await prisma.tag.upsert({
    where: { uq_tags_tenant_name: { tenantId: acmeTenant.id, name: 'brand-identity' } },
    update: {},
    create: {
      id: 'd1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      name: 'brand-identity',
      colorHex: '#3B82F6',
    },
  });

  const productionTag = await prisma.tag.upsert({
    where: { uq_tags_tenant_name: { tenantId: nexusTenant.id, name: 'production' } },
    update: {},
    create: {
      id: 'd2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      name: 'production',
      colorHex: '#EF4444',
    },
  });
  console.log('✅ Tags seeded.');

  // 7. Assets
  const fontAsset = await prisma.asset.upsert({
    where: { id: 'e1111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: 'e1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      categoryId: fontCategory.id,
      name: 'Helvetica Now Pro Complete Family',
      assetType: 'font',
      description: 'Complete 48-font family OpenType layout for marketing',
      fileUrl: 'https://storage.assetvault.internal/acme/fonts/helvetica-now.zip',
      fileSizeBytes: BigInt(45000000),
      mimeType: 'application/zip',
      version: '2.1.0',
      createdByUserId: 'a1111111-1111-1111-1111-111111111112',
    },
  });

  const ideAsset = await prisma.asset.upsert({
    where: { id: 'e2222222-2222-2222-2222-222222222221' },
    update: {},
    create: {
      id: 'e2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      categoryId: ideCategory.id,
      name: 'IntelliJ IDEA Ultimate 2026.2 Linux X64',
      assetType: 'software',
      description: 'Enterprise Java, Kotlin and TypeScript development environment',
      fileUrl: 'https://storage.assetvault.internal/nexus/binaries/ideaIU-2026.2.tar.gz',
      fileSizeBytes: BigInt(1240000000),
      mimeType: 'application/gzip',
      version: '2026.2.0',
      createdByUserId: 'a2222222-2222-2222-2222-222222222221',
    },
  });
  console.log('✅ Assets seeded.');

  // Bind Asset Tags
  await prisma.assetTag.upsert({
    where: { uq_asset_tags: { assetId: fontAsset.id, tagId: brandTag.id } },
    update: {},
    create: {
      assetId: fontAsset.id,
      tagId: brandTag.id,
    },
  });

  await prisma.assetTag.upsert({
    where: { uq_asset_tags: { assetId: ideAsset.id, tagId: productionTag.id } },
    update: {},
    create: {
      assetId: ideAsset.id,
      tagId: productionTag.id,
    },
  });

  // 8. Licenses
  const adobeLicense = await prisma.license.upsert({
    where: { id: 'f1111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: 'f1111111-1111-1111-1111-111111111111',
      tenantId: acmeTenant.id,
      vendorId: adobeVendor.id,
      name: 'Adobe Creative Cloud All Apps - Enterprise',
      licenseKey: 'ADOBE-CC-2026-9938-X821',
      licenseType: 'per_seat',
      totalSeats: 10,
      cost: new Prisma.Decimal('899.99'),
      currency: 'USD',
      startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000),
      isAutoRenew: true,
      renewalReminderDays: 30,
      status: 'active',
    },
  });

  const monotypeLicense = await prisma.license.upsert({
    where: { id: 'f1111111-1111-1111-1111-111111111112' },
    update: {},
    create: {
      id: 'f1111111-1111-1111-1111-111111111112',
      tenantId: acmeTenant.id,
      vendorId: monotypeVendor.id,
      name: 'Monotype Desktop Typography Studio Site License',
      licenseType: 'site',
      totalSeats: 100,
      cost: new Prisma.Decimal('4500.00'),
      currency: 'USD',
      startsAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
  });

  const jetbrainsLicense = await prisma.license.upsert({
    where: { id: 'f2222222-2222-2222-2222-222222222221' },
    update: {},
    create: {
      id: 'f2222222-2222-2222-2222-222222222221',
      tenantId: nexusTenant.id,
      vendorId: jetbrainsVendor.id,
      name: 'JetBrains All Products Commercial Pack - 25 Seats',
      licenseKey: 'JB-ALLPACK-COMM-2026-NEXUS',
      licenseType: 'per_seat',
      totalSeats: 25,
      cost: new Prisma.Decimal('12490.00'),
      currency: 'USD',
      startsAt: new Date(Date.now() - 340 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // Expiring in 25 days!
      status: 'active',
      isAutoRenew: false,
      renewalReminderDays: 30,
    },
  });
  console.log('✅ Licenses seeded.');

  // Bind Asset Licenses
  await prisma.assetLicense.upsert({
    where: { uq_asset_licenses: { assetId: fontAsset.id, licenseId: monotypeLicense.id } },
    update: {},
    create: {
      assetId: fontAsset.id,
      licenseId: monotypeLicense.id,
      notes: 'Governed by Monotype Studio Commercial Terms',
    },
  });

  // 9. Allocations
  await prisma.licenseAllocation.upsert({
    where: { id: '91111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '91111111-1111-1111-1111-111111111111',
      licenseId: adobeLicense.id,
      userId: 'a1111111-1111-1111-1111-111111111113', // Charlie Davis
      notes: 'Allocated for creative brand work',
    },
  });

  await prisma.licenseAllocation.upsert({
    where: { id: '92222222-2222-2222-2222-222222222221' },
    update: {},
    create: {
      id: '92222222-2222-2222-2222-222222222221',
      licenseId: jetbrainsLicense.id,
      userId: 'a2222222-2222-2222-2222-222222222222', // Eva Chen
      notes: 'Allocated for model pipeline development',
    },
  });
  console.log('✅ Seat allocations seeded.');

  // 10. Notifications
  await prisma.notification.create({
    data: {
      tenantId: nexusTenant.id,
      userId: 'a2222222-2222-2222-2222-222222222221', // David Reynolds
      title: 'License Renewal Warning: JetBrains Pack',
      message: 'The JetBrains All Products Commercial Pack expires in 25 days. Please review procurement options.',
      type: 'renewal_due',
      isRead: false,
    },
  });

  console.log('🎉 Seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

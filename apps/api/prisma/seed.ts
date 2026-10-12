// ==============================================================================
// AssetVault Database Seeder
// Seeds reference lookup data: Roles (4), Plans (3), License Types (5)
// Idempotent execution using Prisma upsert
// ==============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting AssetVault reference data seeding...');

  // 1. Seed Roles (4 standard RBAC roles)
  const roles = [
    {
      name: 'SUPER_ADMIN',
      description: 'Global system platform administrator with cross-tenant governance privileges',
    },
    {
      name: 'TENANT_ADMIN',
      description: 'Tenant organization owner with full organizational administration access',
    },
    {
      name: 'ASSET_MANAGER',
      description: 'Asset custodian capable of uploading assets and managing license allocations',
    },
    {
      name: 'MEMBER',
      description: 'Standard organization member with read access and personal checkout rights',
    },
  ];

  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    console.log(`  ✓ Role verified: ${record.name} (id: ${record.id})`);
  }

  // 2. Seed Plans (3 subscription tiers: Free, Pro, Enterprise)
  const plans = [
    {
      name: 'Free Trial',
      maxUsers: 5,
      maxAssets: 100,
      monthlyPrice: 0.00,
      isActive: true,
    },
    {
      name: 'Pro',
      maxUsers: 50,
      maxAssets: 5000,
      monthlyPrice: 49.00,
      isActive: true,
    },
    {
      name: 'Enterprise',
      maxUsers: 500,
      maxAssets: 50000,
      monthlyPrice: 199.00,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const record = await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        maxUsers: plan.maxUsers,
        maxAssets: plan.maxAssets,
        monthlyPrice: plan.monthlyPrice,
        isActive: plan.isActive,
      },
      create: plan,
    });
    console.log(`  ✓ Plan verified: ${record.name} (id: ${record.id})`);
  }

  // 3. Seed License Types (5 commercial archetypes)
  const licenseTypes = [
    {
      name: 'PERPETUAL',
      isSeatBased: false,
      isExpirable: false,
      description: 'One-time procurement license with non-expiring usage rights',
    },
    {
      name: 'SUBSCRIPTION',
      isSeatBased: false,
      isExpirable: true,
      description: 'Time-bounded recurring subscription license renewed periodically',
    },
    {
      name: 'SEAT_BASED',
      isSeatBased: true,
      isExpirable: true,
      description: 'Named seat quota model enforcing maximum concurrent employee allocations',
    },
    {
      name: 'USAGE_BASED',
      isSeatBased: false,
      isExpirable: true,
      description: 'Consumption-metered billing model without fixed seat quotas',
    },
    {
      name: 'OPEN_SOURCE',
      isSeatBased: false,
      isExpirable: false,
      description: 'Permissive or copyleft open-source licenses (MIT, Apache 2.0, BSD, GPL)',
    },
  ];

  for (const lt of licenseTypes) {
    const record = await prisma.licenseType.upsert({
      where: { name: lt.name },
      update: {
        isSeatBased: lt.isSeatBased,
        isExpirable: lt.isExpirable,
        description: lt.description,
      },
      create: lt,
    });
    console.log(`  ✓ License Type verified: ${record.name} (id: ${record.id})`);
  }

  console.log('✅ AssetVault reference data seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

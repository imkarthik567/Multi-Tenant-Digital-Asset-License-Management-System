import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../utils/csv.util';
import { assetRepository } from '../repositories/asset.repository';
import { assetService } from '../services/asset.service';
import { licenseService } from '../services/license.service';
import { vendorService } from '../services/vendor.service';
import { authService } from '../services/auth.service';
import { tenantService } from '../services/tenant.service';
import { prismaForRequest } from '../config/prisma';
import { createLicenseSchema } from '../validators/license.validator';
import { ConflictError, UnauthorizedError, UnprocessableError } from '../errors/AppError';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

test('1. CSV utility strips UTF-8 BOM and parses quoted fields accurately', () => {
  const csvWithBom =
    '\uFEFF"asset_code","name","asset_type","description"\n' +
    '"VIT-001","Campus Portal","SOFTWARE","Line 1, with comma"\n';
  const { headers, rows } = parseCsv(csvWithBom);
  assert.deepEqual(headers, ['asset_code', 'name', 'asset_type', 'description']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_code, 'VIT-001');
  assert.equal(rows[0].name, 'Campus Portal');
  assert.equal(rows[0].asset_type, 'SOFTWARE');
  assert.equal(rows[0].description, 'Line 1, with comma');

  const serialized = toCsv(rows, ['asset_code', 'name', 'asset_type', 'description']);
  assert.ok(serialized.includes('"VIT-001"'));
});

test('2. License Zod validator preserves contract terms and validates input', () => {
  const parsed = createLicenseSchema.parse({
    name: 'VIT Microsoft 365 Campus Plan',
    licenseKey: 'VIT-M365-2026-001',
    vendorId: 'vendor-msft',
    licenseTypeId: 3,
    totalSeats: 100,
    cost: 1200,
    currency: 'USD',
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    autoRenew: true,
    terms: 'Academic campus-wide enterprise agreement.',
  });
  assert.equal(parsed.terms, 'Academic campus-wide enterprise agreement.');
});

test('3. Asset creation with tags strips non-Prisma tags field before prisma.asset.create', async () => {
  let capturedCreatePayload: any = null;
  const fakePrisma: any = {
    asset: {
      create: async (args: any) => {
        capturedCreatePayload = args.data;
        return { id: 'ast-1', ...args.data };
      },
    },
  };

  await assetRepository.create(fakePrisma, {
    name: 'Tagged Asset',
    assetCode: 'TAG-AST-01',
    assetType: 'SOFTWARE',
    tags: ['Engineering', 'Production'],
  } as any);

  assert.ok(capturedCreatePayload);
  assert.equal(capturedCreatePayload.tags, undefined);
  assert.equal(capturedCreatePayload.assetCode, 'TAG-AST-01');
});

test('4. Asset bulkImport infers empty asset_type, maps aliases, and rejects invalid explicit types with 422', async () => {
  const techcorp = await systemPrisma.tenant.findUnique({ where: { slug: 'techcorp' } });
  assert.ok(techcorp);
  const admin = await systemPrisma.user.findFirst({ where: { tenantId: techcorp.id } });
  assert.ok(admin);

  // Invalid explicit type must throw UnprocessableError (422)
  const invalidCsv =
    'asset_code,name,asset_type,description\n' +
    `BAD-CSV-${Date.now()},Bad Asset,NON_EXISTENT_TYPE,Should fail\n`;
  await assert.rejects(
    () => assetService.bulkImport(techcorp.id, admin.id, invalidCsv),
    (err: any) => err instanceof UnprocessableError
  );

  // Valid CSV with alias ("DOC") and empty type (inferred from name " Handbook ") must succeed
  const suffix = Date.now();
  const validCsv =
    '\uFEFFasset_code,name,asset_type,description\n' +
    `BULK-DOC-${suffix},University Policy Manual,DOC,Policy document\n` +
    `BULK-INF-${suffix},Student Academic Handbook 2026,,Inferred document type\n`;
  const res = await assetService.bulkImport(techcorp.id, admin.id, validCsv);
  assert.equal(res.importedCount, 2);

  // Clean up test bulk-imported assets so workspace state stays clean
  const createdAssets = await systemPrisma.asset.findMany({
    where: {
      tenantId: techcorp.id,
      OR: [
        { assetCode: { startsWith: 'BULK-DOC-' } },
        { assetCode: { startsWith: 'BULK-INF-' } },
      ],
    },
    select: { id: true },
  });
  const createdIds = createdAssets.map((a: any) => a.id);
  if (createdIds.length > 0) {
    await systemPrisma.assetVersion.deleteMany({ where: { assetId: { in: createdIds } } });
    await systemPrisma.assetTag.deleteMany({ where: { assetId: { in: createdIds } } });
    await systemPrisma.asset.deleteMany({ where: { id: { in: createdIds } } });
  }
});

test('5. Vendor creation, license creation with vendor & terms, soft-delete license, and vendor deletion', async () => {
  const techcorp = await systemPrisma.tenant.findUnique({ where: { slug: 'techcorp' } });
  assert.ok(techcorp);

  const vendorName = `Audit Vendor ${Date.now()}`;
  const vendor = await vendorService.createVendor(systemPrisma, {
    tenantId: techcorp.id,
    name: vendorName,
    contactEmail: 'audit@vendor.io',
    website: 'https://vendor.io',
  });
  assert.equal(vendor.name, vendorName);

  const licenseKey = `LIC-AUDIT-${Date.now()}`;
  const license = await licenseService.createLicense(systemPrisma, techcorp.id, {
    name: 'Audit Software Suite',
    licenseKey,
    vendorId: vendor.id,
    licenseTypeId: 3,
    totalSeats: 10,
    cost: 500,
    currency: 'USD',
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    autoRenew: true,
    terms: 'Enterprise audit license terms',
  });
  assert.equal(license.name, 'Audit Software Suite');

  // Active license blocks vendor deletion
  await assert.rejects(
    () => vendorService.deleteVendor(systemPrisma, vendor.id),
    (err: any) => err instanceof ConflictError
  );

  // Soft-delete the license
  await licenseService.softDeleteLicense(systemPrisma, license.id);

  // Deleting vendor now succeeds because the only license is soft-deleted
  const deletedVendor = await vendorService.deleteVendor(systemPrisma, vendor.id);
  assert.equal(deletedVendor.id, vendor.id);
});

test('6. Auth login rejects wrong password and closed organization workspace appropriately', async () => {
  // Wrong password for existing user must throw UnauthorizedError('Invalid email or password')
  await assert.rejects(
    () =>
      authService.login({
        email: 'techcorp.admin@techcorp.io',
        password: 'WrongPassword999!',
      }),
    (err: any) => err instanceof UnauthorizedError && err.message === 'Invalid email or password'
  );

  // Create a temporary tenant, close it, and verify login and Google SSO behavior
  const suffix = Date.now();
  const tempEmail = `closed.admin.${suffix}@example.com`;
  const reg = await authService.registerTenant({
    tenantName: `Temp Org ${suffix}`,
    slug: `temp-org-${suffix}`,
    contactEmail: tempEmail,
    adminFullName: 'Temp Admin',
    adminEmail: tempEmail,
    password: 'Password123!',
  });
  assert.ok(reg.user.tenantId);

  await tenantService.closeOrganization(
    systemPrisma,
    reg.user.tenantId!,
    reg.user.id,
    `Temp Org ${suffix}`
  );

  // Email+password sign-in after org closure must report no active workspace exists
  await assert.rejects(
    () =>
      authService.login({
        email: tempEmail,
        password: 'Password123!',
      }),
    (err: any) =>
      err instanceof UnauthorizedError &&
      err.message.includes('No active organization workspace exists')
  );

  // Google SSO sign-in after org closure must prompt to create a new organization workspace
  const ssoRes = await authService.googleSso({
    email: tempEmail,
    fullName: 'Temp Admin',
  });
  assert.equal(ssoRes.requiresOnboarding, true);
});

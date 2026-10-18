const seededDemoPassword = (): string => {
  const password = process.env.DEFAULT_SEED_PASSWORD;
  if (!password) {
    throw new Error('Set DEFAULT_SEED_PASSWORD in the untracked .env before running seeded-user tests.');
  }
  return password;
};

const loginAs = async (page: any, email: string) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(seededDemoPassword());
  await page.click('button[type="submit"]');
};

import { test, expect } from '@playwright/test';

test.describe('E2E Journey 1: Authentication & Role-Based Access Control Navigation', () => {
  test('Tenant Admin sees administrative menus; Member has restricted view with 403 enforcement', async ({
    page,
  }) => {
    // -------------------------------------------------------------------------
    // 1. Log in as Tenant Admin
    // -------------------------------------------------------------------------
    await loginAs(page, 'techcorp.admin@techcorp.io');
    await expect(page).toHaveTitle(/AssetVault/i);

    // Wait for Dashboard to mount
    await expect(page).toHaveURL(/\//);
    await expect(page.locator('text=TechCorp Dynamics').first()).toBeVisible({ timeout: 15000 });

    // Verify Admin menu items in sidebar
    await expect(page.locator('aside >> text=Digital Assets')).toBeVisible();
    await expect(page.locator('aside >> text=Licenses')).toBeVisible();
    await expect(page.locator('aside >> text=Vendors')).toBeVisible();
    await expect(page.locator('aside >> text=Users & Roles')).toBeVisible();
    await expect(page.locator('aside >> text=Audit Trail')).toBeVisible();
    await expect(page.locator('aside >> text=Analytical Reports')).toBeVisible();

    // -------------------------------------------------------------------------
    // 2. Log out
    // -------------------------------------------------------------------------
    // Click user dropdown menu in top navbar and log out
    await page.click('button[aria-label="User profile menu"]');
    await page.click('text=Log out');
    await expect(page).toHaveURL(/\/login/);

    // -------------------------------------------------------------------------
    // 3. Log in as Member (Developer)
    // -------------------------------------------------------------------------
    await loginAs(page, 'techcorp.dev1@techcorp.io');

    await expect(page).toHaveURL(/\//);
    await expect(page.locator('text=TechCorp Dynamics').first()).toBeVisible({ timeout: 15000 });

    // Verify Member navigation: Member items exist, Admin-only items do NOT exist
    await expect(page.locator('aside >> text=Digital Assets')).toBeVisible();
    await expect(page.locator('aside >> text=My Licenses')).toBeVisible();
    await expect(page.locator('aside >> text=Notifications')).toBeVisible();

    // Admin pages MUST NOT be visible to Member
    await expect(page.locator('aside >> text=Users & Roles')).not.toBeVisible();
    await expect(page.locator('aside >> text=Audit Trail')).not.toBeVisible();
    await expect(page.locator('aside >> text=Vendors')).not.toBeVisible();

    // -------------------------------------------------------------------------
    // 4. Verify 403 Forbidden on direct URL navigation to administrative pages
    // -------------------------------------------------------------------------
    await page.goto('/users');
    await expect(page).toHaveURL(/\/403/);
    await expect(page.locator('text=Access Forbidden')).toBeVisible({ timeout: 10000 });

    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/403/);
    await expect(page.locator('text=Access Forbidden')).toBeVisible({ timeout: 10000 });
  });
});

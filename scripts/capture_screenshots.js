// ==============================================================================
// AssetVault: Responsive Screenshot & Persona Automation Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Captures responsive screens across Desktop (1280px), Tablet (768px), and Mobile (375px)
// Preserves in-memory JWT session via client-side SPA navigation
// ==============================================================================

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Launching headless Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('  [Browser]', msg.text()));
  page.on('pageerror', (err) => console.log('  [Browser Error]', err.message));

  async function capture(filename, viewport = VIEWPORTS.desktop) {
    await page.setViewport(viewport);
    await sleep(800);
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`📸 Captured: ${filename} (${viewport.width}x${viewport.height})`);
  }

  // SPA navigation helper that preserves in-memory JWT token
  async function spaNavigate(routePath) {
    console.log(`🧭 Navigating to: ${routePath}`);
    await page.evaluate((p) => {
      if (window.__navigate) {
        window.__navigate(p);
      } else {
        window.history.pushState({}, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }, routePath);
    await sleep(2000);
  }

  // Persona Login Helper
  async function loginAsPersona(roleKeyword) {
    console.log(`\n🔑 Authenticating as: ${roleKeyword}...`);
    await page.setViewport(VIEWPORTS.desktop);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(800);

    const clicked = await page.evaluate((kw) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.innerText.toLowerCase().includes(kw.toLowerCase()));
      if (btn) {
        btn.click();
        return btn.innerText.replace(/\n/g, ' ');
      }
      return null;
    }, roleKeyword);

    console.log(`  👉 Selected Persona: "${clicked}"`);
    await sleep(400);

    await page.click('button[type="submit"]');
    await page.waitForSelector('aside', { timeout: 10000 });
    await sleep(1500);
    console.log(`✅ Logged in successfully. Current route: ${page.url()}`);
  }

  try {
    // -------------------------------------------------------------------------
    // 1. PUBLIC AUTH PAGES
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Capturing Public Auth Pages ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await capture('01_login_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('01_login_tablet_768px.png', VIEWPORTS.tablet);
    await capture('01_login_mobile_375px.png', VIEWPORTS.mobile);

    await page.goto(`${BASE_URL}/register-tenant`, { waitUntil: 'domcontentloaded' });
    await capture('02_register_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('02_register_mobile_375px.png', VIEWPORTS.mobile);

    // -------------------------------------------------------------------------
    // 2. TENANT ADMIN WORKFLOW (TechCorp)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Tenant Administrator Experience ---');
    await loginAsPersona('Tenant Admin');

    // Dashboard
    await capture('03_admin_dashboard_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('03_admin_dashboard_tablet_768px.png', VIEWPORTS.tablet);
    await capture('03_admin_dashboard_mobile_375px.png', VIEWPORTS.mobile);

    // Toggle Dark Theme
    const themeButton = await page.$('button[title*="theme" i], button[aria-label*="theme" i]');
    if (themeButton) {
      await themeButton.click();
      await sleep(600);
      await capture('03_admin_dashboard_dark_1280px.png', VIEWPORTS.desktop);
      await themeButton.click(); // Revert back
      await sleep(400);
    }

    // Asset Catalog
    await spaNavigate('/assets');
    await capture('04_assets_catalog_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('04_assets_catalog_tablet_768px.png', VIEWPORTS.tablet);
    await capture('04_assets_catalog_mobile_375px.png', VIEWPORTS.mobile);

    // Asset Detail View
    await spaNavigate('/assets/1fcf8407-88cf-44b2-ad89-fadcf3892715');
    await capture('05_asset_detail_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('05_asset_detail_mobile_375px.png', VIEWPORTS.mobile);

    // License Catalog
    await spaNavigate('/licenses');
    await capture('06_licenses_catalog_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('06_licenses_catalog_mobile_375px.png', VIEWPORTS.mobile);

    // License Detail View
    await spaNavigate('/licenses/cc76a6f3-1855-4322-a494-238b70cd3b15');
    await capture('07_license_detail_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('07_license_detail_mobile_375px.png', VIEWPORTS.mobile);

    // Analytical Reports (Visualizations)
    await spaNavigate('/reports');
    await capture('08_reports_analytics_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('08_reports_analytics_mobile_375px.png', VIEWPORTS.mobile);

    // Category Hierarchy Tree
    await spaNavigate('/categories');
    await capture('09_categories_tree_desktop_1280px.png', VIEWPORTS.desktop);

    // User Management
    await spaNavigate('/users');
    await capture('10_users_table_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('10_users_table_mobile_375px.png', VIEWPORTS.mobile);

    // Notifications Center
    await spaNavigate('/notifications');
    await capture('11_notifications_desktop_1280px.png', VIEWPORTS.desktop);

    // Compliance Audit Trail
    await spaNavigate('/audit-logs');
    await capture('12_audit_logs_desktop_1280px.png', VIEWPORTS.desktop);

    // -------------------------------------------------------------------------
    // 3. MEMBER WORKFLOW (Self-Service Portal)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Standard Member Experience ---');
    await loginAsPersona('Member');
    await spaNavigate('/my-licenses');
    await capture('13_member_my_licenses_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('13_member_my_licenses_mobile_375px.png', VIEWPORTS.mobile);

    // -------------------------------------------------------------------------
    // 4. SUPER ADMIN PLATFORM GOVERNANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Super Administrator Governance ---');
    await loginAsPersona('Super Admin');
    await spaNavigate('/');
    await capture('14_superadmin_overview_desktop_1280px.png', VIEWPORTS.desktop);

    await spaNavigate('/platform/tenants');
    await capture('15_platform_tenants_desktop_1280px.png', VIEWPORTS.desktop);

    await spaNavigate('/platform/plans');
    await capture('16_platform_plans_desktop_1280px.png', VIEWPORTS.desktop);

    console.log('\n🎉 ALL RESPONSIVE SCREENSHOTS CAPTURED BEAUTIFULLY!');
  } catch (err) {
    console.error('❌ Capture error:', err);
  } finally {
    await browser.close();
  }
}

run();

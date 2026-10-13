const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('  [Browser]', msg.text()));
  page.on('pageerror', (err) => console.log('  [Browser Error]', err.message));

  console.log('1. Navigating to /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });

  console.log('2. Clicking Tenant Admin demo button...');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.innerText.includes('Tenant Admin'));
    if (btn) {
      btn.click();
      return btn.innerText.replace(/\n/g, ' ');
    }
    return null;
  });
  console.log('  Selected:', clicked);

  await sleep(500);
  console.log('3. Clicking submit button...');
  await page.click('button[type="submit"]');

  await sleep(4000);
  console.log('4. Current URL:', page.url());

  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 300));
  console.log('5. Root HTML snippet:', rootHtml);

  await page.screenshot({ path: 'docs/screenshots/test_tenant_dashboard.png' });
  console.log('6. Saved test_tenant_dashboard.png');

  await browser.close();
}

run().catch(console.error);

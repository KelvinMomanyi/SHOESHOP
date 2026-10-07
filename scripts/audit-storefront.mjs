import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [label = 'before', url = 'https://shoeshive.myshopify.com/'] = process.argv.slice(2);
const tooling = process.env.TREADORA_LIGHTHOUSE_ROOT;
if (!tooling) throw new Error('Set TREADORA_LIGHTHOUSE_ROOT to the node_modules directory containing Lighthouse.');
const load = (file) => import(pathToFileURL(path.join(tooling, file)).href);
const [{ default: lighthouse }, chromeLauncher, { default: puppeteer }] = await Promise.all([
  load('lighthouse/core/index.js'), load('chrome-launcher/dist/index.js'), load('puppeteer-core/lib/puppeteer/puppeteer-core.js')
]);
const output = path.resolve('audits', label);
await mkdir(output, { recursive: true });
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'], logLevel: 'silent' });
let browser;
try {
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const cookies = (process.env.TREADORA_AUDIT_COOKIES || '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return { name: part.slice(0, separator).trim(), value: part.slice(separator + 1), domain: new URL(url).hostname, path: '/', secure: true };
  });
  if (cookies.length) await browser.defaultBrowserContext().setCookie(...cookies);
  delete process.env.TREADORA_AUDIT_COOKIES;
  const page = await browser.newPage();
  const expectedTheme = process.env.TREADORA_EXPECT_THEME_ID;
  if (expectedTheme) {
    const selected = new URL(url);
    selected.searchParams.set('preview_theme_id', expectedTheme);
    selected.searchParams.set('pb', '0');
    await page.goto(selected.href, { waitUntil: 'domcontentloaded' });
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (new URL(page.url()).pathname === '/password') throw new Error('Storefront is locked; refusing to report the password page as the theme.');
  const theme = await page.evaluate(() => window.Shopify?.theme);
  if (expectedTheme && String(theme?.id) !== expectedTheme) throw new Error(`Expected theme ${expectedTheme}, received ${theme?.id}.`);
  await writeFile(path.join(output, 'context.json'), JSON.stringify({ theme, url, browser: await browser.version(), cache: 'Browser network cache cleared before each Lighthouse run; storefront cookies retained.' }, null, 2));
  console.log(JSON.stringify({ label, theme }));
  for (const device of process.env.TREADORA_AUDIT_CAPTURE_ONLY ? [] : (process.env.TREADORA_AUDIT_DEVICES || 'mobile,desktop').split(',')) {
    const client = await page.createCDPSession();
    await client.send('Network.clearBrowserCache');
    await client.detach();
    const config = device === 'desktop' ? (await load('lighthouse/core/config/desktop-config.js')).default : undefined;
    const result = await lighthouse(url, {
      port: chrome.port, disableStorageReset: true, output: ['json', 'html'], logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
    }, config);
    if (new URL(result.lhr.finalDisplayedUrl).pathname === '/password') throw new Error('Lighthouse reached the password page.');
    await writeFile(path.join(output, `${device}.json`), result.report[0]);
    await writeFile(path.join(output, `${device}.html`), result.report[1]);
    console.log(JSON.stringify({ device, url: result.lhr.finalDisplayedUrl, scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)])), metrics: Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'first-contentful-paint'].map(k => [k, result.lhr.audits[k].numericValue])), failed: Object.values(result.lhr.audits).filter(a => a.score !== null && a.score < 1).map(a => ({ id: a.id, title: a.title, value: a.displayValue })) }));
  }
  if (!process.env.TREADORA_AUDIT_LIGHTHOUSE_ONLY) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.coverage.startJSCoverage();
  await page.coverage.startCSSCoverage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, 'mobile.png') });
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ url: r.name, type: r.initiatorType, transferBytes: r.transferSize, decodedBytes: r.decodedBodySize, duration: r.duration, renderBlocking: r.renderBlockingStatus })));
  const summarize = (entries) => entries.map(e => ({ url: e.url, bytes: Buffer.byteLength(e.text), usedBytes: e.ranges.reduce((total, r) => total + Buffer.byteLength(e.text.slice(r.start, r.end)), 0) }));
  await writeFile(path.join(output, 'coverage.json'), JSON.stringify({ scope: 'Initial mobile viewport, before interaction; unused does not mean safe to delete.', js: summarize(await page.coverage.stopJSCoverage()), css: summarize(await page.coverage.stopCSSCoverage()), resources }, null, 2));
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1, isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const positions = new URL(url).pathname === '/collections' ? ['top', 'directory', 'footer'] : ['hero', 'highlight', 'collections'];
    for (const position of positions) {
      await page.evaluate((name) => {
        const selectors = { hero: '[data-scroll-hero]', highlight: 'scroll-highlight', collections: '.collection-showcase', directory: '.collection-directory', footer: '.site-footer' };
        const element = document.querySelector(selectors[name] || 'main');
        window.scrollTo({ top: ['hero', 'top'].includes(name) ? 0 : (element?.getBoundingClientRect().top || 0) + scrollY, behavior: 'instant' });
      }, position);
      await new Promise(resolve => setTimeout(resolve, 600));
      await page.screenshot({ path: path.join(output, `${viewport.width}-${position}.png`) });
    }
  }
  const checks = [];
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  checks.push(await page.evaluate(() => ({
    page: location.pathname, theme: window.Shopify?.theme?.id,
    h1Count: document.querySelectorAll('h1').length,
    inactiveSlides: document.querySelectorAll('.editorial-hero__panel[inert]').length,
    homepageLoadsPageMotion: performance.getEntriesByType('resource').some(r => r.name.includes('/page-motion.min.js'))
  })));
  for (const selector of ['header [data-modal-drawer]:not([data-cart-drawer])', 'header [data-search-drawer]', 'header [data-cart-drawer]']) {
    if (!await page.$(`${selector} > summary`)) continue;
    await page.click(`${selector} > summary`);
    await page.waitForFunction(s => document.querySelector(s)?.open, { timeout: 5000 }, selector);
    await new Promise(resolve => setTimeout(resolve, 600));
    await page.keyboard.press('Escape');
    await page.waitForFunction(s => !document.querySelector(s)?.open, { timeout: 5000 }, selector);
    checks.push({ control: selector, opensAndClosesWithEscape: true });
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const route = (pathname) => { const target = new URL(url); target.pathname = pathname; return target.href; };
  for (const pathname of ['/collections', '/collections/all']) {
    const response = await page.goto(route(pathname), { waitUntil: 'networkidle2', timeout: 60000 });
    checks.push(await page.evaluate((status) => ({ page: location.pathname, status,
      directoryReady: document.querySelector('[data-collection-directory]')?.dataset.collectionDirectoryReady,
      collectionEditReady: document.querySelector('[data-collection-edit]')?.dataset.collectionEditReady,
      scripts: performance.getEntriesByType('resource').filter(r => /\/(page-motion|collection-directory|motion-effects)\.min\.js/.test(r.name)).map(r => r.name)
    }), response.status()));
  }
  const productHandle = await page.evaluate(async () => {
    const response = await fetch('/products.json?limit=1');
    return response.ok ? (await response.json()).products?.[0]?.handle : null;
  });
  if (productHandle) {
    const response = await page.goto(route(`/products/${productHandle}`), { waitUntil: 'networkidle2', timeout: 60000 });
    checks.push(await page.evaluate(status => ({ page: location.pathname, status,
      productMotionReady: document.querySelector('[data-product-editorial]')?.dataset.productEditorialReady,
      pageMotionLoaded: performance.getEntriesByType('resource').some(r => r.name.includes('/page-motion.min.js'))
    }), response.status()));
  } else checks.push({ page: 'product', skipped: 'No published products returned by storefront.' });
  await writeFile(path.join(output, 'smoke.json'), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ smoke: checks }));
  }
} finally {
  await browser?.disconnect();
  await chrome.kill();
}

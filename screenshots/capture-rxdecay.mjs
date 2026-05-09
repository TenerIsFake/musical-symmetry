import puppeteer from './node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const OUTPUT_DIR = '/home/tener/handoff/vault/02_Product/RxDecay/screenshots';

const pages = [
  { url: 'http://localhost:3011/', file: 'rxdecay-01-tracker.png', label: 'tracker' },
  { url: 'http://localhost:3011/chart', file: 'rxdecay-02-chart.png', label: 'chart' },
  { url: 'http://localhost:3011/log', file: 'rxdecay-03-log.png', label: 'log' },
  { url: 'http://localhost:3011/reminders', file: 'rxdecay-04-reminders.png', label: 'reminders' },
];

const VIEWPORT = {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
};

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const captured = [];
  const skipped = [];

  for (const page of pages) {
    const tab = await browser.newPage();
    await tab.setViewport(VIEWPORT);

    try {
      console.log(`Loading ${page.url}...`);
      const response = await tab.goto(page.url, { waitUntil: 'networkidle2', timeout: 15000 });

      if (!response || response.status() >= 400) {
        console.log(`  SKIP: HTTP ${response ? response.status() : 'no response'}`);
        skipped.push(page.label);
        await tab.close();
        continue;
      }

      // Wait 3 seconds
      await new Promise(r => setTimeout(r, 3000));

      // Check if page has meaningful content
      const bodyText = await tab.evaluate(() => document.body ? document.body.innerText.trim() : '');
      if (!bodyText || bodyText.length < 10) {
        console.log(`  SKIP: blank page`);
        skipped.push(page.label);
        await tab.close();
        continue;
      }

      const outPath = `${OUTPUT_DIR}/${page.file}`;
      await tab.screenshot({ path: outPath, fullPage: false });
      console.log(`  SAVED: ${outPath}`);
      captured.push(page.label);
    } catch (err) {
      console.log(`  SKIP: ${err.message}`);
      skipped.push(page.label);
    }

    await tab.close();
  }

  await browser.close();

  console.log('\n--- SUMMARY ---');
  console.log('Captured:', captured.join(', ') || '(none)');
  console.log('Skipped:', skipped.join(', ') || '(none)');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

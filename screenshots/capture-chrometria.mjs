import puppeteer from 'puppeteer';
import { join } from 'path';

const BASE_URL = 'http://localhost:3009';
const OUTPUT_DIR = '/home/tener/handoff/vault/02_Product/Chrometria/screenshots';

const PAGES = [
  { path: '/',                 name: 'chrometria-01-dashboard' },
  { path: '/classifier',       name: 'chrometria-02-classifier' },
  { path: '/analyzer',         name: 'chrometria-03-analyzer' },
  { path: '/atlas',            name: 'chrometria-04-atlas' },
  { path: '/ear-training',     name: 'chrometria-05-ear-training' },
  { path: '/progression',      name: 'chrometria-06-progression' },
  { path: '/interval-cycles',  name: 'chrometria-07-interval-cycles' },
  { path: '/voice-leading',    name: 'chrometria-08-voice-leading' },
];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const { path, name } of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625 });
  const url = `${BASE_URL}${path}`;
  console.log(`Capturing: ${name} (${url})`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  const outPath = join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  -> saved: ${outPath}`);
  await page.close();
}

await browser.close();
console.log('Done. All screenshots saved.');

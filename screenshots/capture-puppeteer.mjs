import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3009';

const PAGES = [
  { hash: '', name: 'landing-page' },
  { hash: '#classifier', name: 'pitch-class-classifier' },
  { hash: '#analyzer', name: 'file-analyzer' },
  { hash: '#euclidean', name: 'euclidean-rhythms' },
  { hash: '#harmonic-path', name: 'tonnetz-harmonic-paths' },
  { hash: '#sketchpad', name: 'composition-sketchpad' },
  { hash: '#transform', name: 'transform-chain' },
  { hash: '#orchestration', name: 'orchestration-engine' },
];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const { hash, name } of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625 });
  const url = `${BASE_URL}/${hash}`;
  console.log(`Capturing: ${name} (${url})`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: join(__dirname, `${name}.png`), fullPage: false });
  await page.close();
}

await browser.close();
console.log('Done. Screenshots saved.');

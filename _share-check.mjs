import playwright from 'file:///C:/Users/xwm/AppData/Local/Temp/playwright-run/node_modules/playwright/index.js';

const { chromium } = playwright;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => sessionStorage.setItem('anniv-2048-auth-2', '1'));
await page.goto('http://localhost:4173/');
await page.waitForSelector('#share');
await page.evaluate(() => {
  localStorage.setItem('anniv-2048-best-classic', '128');
});
await page.reload();
await page.waitForSelector('#best');
const best = await page.locator('#best').innerText();
await page.locator('#share').click();
await page.waitForSelector('#share-sheet:not(.hidden)');
const labels = await page.locator('#share-sheet .btn').allInnerTexts();
await page.screenshot({ path: 'C:/Users/xwm/AppData/Local/Temp/2048-shots/share-sheet.png' });

await page.evaluate(() => {
  window.__shared = [];
  navigator.share = async (data) => {
    window.__shared.push({ ...data, files: data.files ? data.files.length : 0 });
  };
  navigator.canShare = (data) => !data || !data.files;
});
await page.locator('#share-link').click();
await page.waitForFunction(() => window.__shared.length === 1);
const linkShare = await page.evaluate(() => window.__shared[0]);
const sheetClosed = await page.locator('#share-sheet').evaluate((el) => el.classList.contains('hidden'));

await page.locator('#share').click();
await page.waitForSelector('#share-sheet:not(.hidden)');
await page.evaluate(() => {
  window.__shared = [];
  navigator.canShare = () => false;
});
const downloadPromise = page.waitForEvent('download');
await page.locator('#share-score').click();
const download = await downloadPromise;
const note = await page.locator('#share-note').innerText();
const filePath = 'C:/Users/xwm/AppData/Local/Temp/2048-shots/score-card.png';
await download.saveAs(filePath);

if (linkShare.url !== page.url() || linkShare.title !== '2048 for Hadyn') {
  throw new Error(`link share mismatch ${JSON.stringify(linkShare)}`);
}
if (!sheetClosed) throw new Error('share sheet stayed open after sharing the link');
if (download.suggestedFilename() !== 'hadyn-2048.png') {
  throw new Error(`unexpected file ${download.suggestedFilename()}`);
}
if (note !== 'score card saved') throw new Error(`note was ${note}`);

console.log(JSON.stringify({ best, labels, linkShare, note }, null, 2));
console.log('PASS');
await browser.close();

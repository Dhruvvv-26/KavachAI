const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', error => console.log('ERR:', error.message));
  await page.goto('http://localhost:3002/shap', { waitUntil: 'networkidle0' });
  await browser.close();
})();

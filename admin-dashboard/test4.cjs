const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('admin_jwt', 'mock_jwt');
  });
  await page.goto('http://localhost:3002/shap', { waitUntil: 'networkidle0' });
  const html = await page.evaluate(() => document.querySelector('.main').innerHTML);
  console.log(html);
  await browser.close();
})();

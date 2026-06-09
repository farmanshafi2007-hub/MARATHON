const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('requestfailed', request => {
        console.log('BROWSER REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    console.log('Navigating...');
    await page.goto('http://localhost:3000');
    
    setTimeout(async () => {
        await browser.close();
    }, 5000);
})();

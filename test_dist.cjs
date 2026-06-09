const puppeteer = require('puppeteer');
const http = require('http');
const handler = require('serve-handler');

(async () => {
    // Start server for dist
    const server = http.createServer((request, response) => {
        return handler(request, response, { public: 'dist' });
    });
    server.listen(3002, () => console.log('Serving /dist on 3002'));

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    console.log('Navigating...');
    await page.goto('http://localhost:3002');
    
    setTimeout(async () => {
        await browser.close();
        server.close();
        process.exit(0);
    }, 5000);
})();

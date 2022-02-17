const certDir = `/etc/letsencrypt/live`;
const domain = `api.hypertrons.com`;

const fs = require('fs');
const path = require('path');
const https = require('https');

const next = require('next');
const app = next({})

const options = {
    key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
    cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};

const port = 443;
app.prepare().then(() => {
    https.createServer(options).listen(port, err => {
        if (err) { throw err; }
        console.log(`> Ready on localhost:${port}`)
    });
});

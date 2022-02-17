const certDir = `/etc/letsencrypt/live`;
const domain = `www.hypertrons.com`;

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const next = require('next');
const app = next({});
const handle = app.getRequestHandler();

const options = {
    key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
    cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};

const port = 443;
app.prepare().then(() => {
    const server = express();

    server.get('*', (req, res) => {
        return handle(req, res);
    });

    https.createServer(options, server).listen(port, err => {
        if (err) { throw err; }
        console.log(`> Ready on localhost:${port}`)
    });
});

const certDir = `/etc/letsencrypt/live`;
const domain = `mining3.io`;

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const port = dev ? 3000 : 443;
const app = next({dev});
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();

    server.get('*', (req, res) => {
        return handle(req, res);
    });

    if (process.env.NODE_ENV == 'production') {
        const options = {
            key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
            cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
        };
        https.createServer(options, server).listen(port, err => {
            if (err) { throw err; }
            console.log(`> Mining3 listening on port ${port}`)
        });
    } else {
        server.listen(port, () => {
            console.log(`> Mining3 listening on port ${port}`)
        })
    }
});

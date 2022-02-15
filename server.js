require('dotenv').config();

const certDir = `/etc/letsencrypt/live`;
const domain = `api.hypertrons.com`;

const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const app = express();

const cors = require('cors');
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true)
  }
}
app.use(cors(corsOptions));

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const token = require("./routes/api/token");
const contract = require("./routes/api/contract");
app.use("/api/v1/token", token);
app.use("/api/v1/contract", contract);
app.use('/static', express.static(path.join(__dirname, 'files')))

const options = {
    key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
    cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};
https.createServer(options, app).listen(443);

module.exports=app;

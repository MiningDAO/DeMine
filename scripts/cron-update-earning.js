const { ethers } = hre = require("hardhat");
const { load } = require('../lib/bootstrap.js');
const cron = require('node-cron');
const redis = require('redis').createClient();

cron.schedule('0 0 */24 * *', async () => {
    await load('btc', redis);
});

const assert = require("assert");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');
const tls = require("tls");
const API_URL = 'https://antpool.com/api/';

tls.DEFAULT_MIN_VERSION = "TLSv1.2";
tls.DEFAULT_MAX_VERSION = "TLSv1.2";

function prep(config) {
    const nonce = new Date().getTime();
    const msg = config.userId + config.key + nonce;
    const signature = createHmac(
        'sha256', config.secret
    ).update(msg).digest('hex').toUpperCase();
    return {
        key: config.key,
        nonce: nonce,
        signature: signature
    }
}

async function query(endpoint, data) {
    const qs = new URLSearchParams(data);
    const instace = axios.create();
    const response = await instace.request({
        url: `${API_URL}${endpoint}?${qs.toString()}`,
        method: 'POST'
    });
    assert(
        response.status == 200 && response.data.code == 0,
        'Respones error: ' + JSON.stringify(response.data)
    );
    return response.data.data;
}

async function hashrate(config, coin) {
    return query('hashrate.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function account(config, coin) {
    return query('account.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function accountOverview(config, coin) {
    return query('accountOverview.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function calculate(config, coin) {
    return query('coinCalculator.htm', {
        coinType: coin.toUpperCase(),
        feePercent: config.feePercent,
        hashInput: 1000000000000,
        ...prep(config)
    });
}

async function userHashrateChart(config, coin) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];
    return query('userHashrateChart.htm ', {
        coinType: coin.toUpperCase(),
        userId: config.userId,
        userWorkerId: '',
        date: date + ' 00:00:00',
        type: 2,
        ...prep(config)
    });
}

async function getRewardPerTH(localConfig, coin) {
    const antAccount = await account(localConfig.antpool, coin);
    const antHashrate = await hashrate(localConfig.antpool, coin);
    const hashrateTH = antHashrate.last1d / 1000000;
    const reward = Math.floor(
        antAccount.earn24Hours * 100000000 / hashrateTH
    );
    return [hashrateTH, reward];
}

async function getRewardPerTHV2(localConfig, coin) {
    const overview = await accountOverview(localConfig.antpool, coin);
    const hashrate = overview.hsLast1d / 1000000000000;
    const reward = Math.floor(
        overview.yesterdayAmount * 100000000 / hashrate
    );
    return [hashrate, reward];
}

async function getRewardPerTHV3(localConfig, coin) {
    const overview = await accountOverview(localConfig.antpool, coin);
    const hashrate = await userHashrateChart(localConfig.antpool, coin);
    const reward = Math.floor(
        overview.yesterdayAmount * 100000000 / 100
    );
    return [hashrate, reward];
}

module.exports = {
    getRewardPerTH: getRewardPerTH,
    getRewardPerTHV2: getRewardPerTHV2,
    getRewardPerTHV3: getRewardPerTHV3
}

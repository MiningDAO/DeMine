const assert = require("assert");
const common = require("./common.js");
const token = require("./common.js");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');
const tls = require("tls");
const API_URL = 'https://antpool.com/api/';

tls.DEFAULT_MIN_VERSION = "TLSv1.2";
tls.DEFAULT_MAX_VERSION = "TLSv1.2";

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

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

async function userHashrateChart(config, coin, date) {
    const day = date.toISOString().split('T')[0];
    return query('userHashrateChart.htm ', {
        coinType: coin.toUpperCase(),
        userId: config.userId,
        date: day + ' 00:00:00',
        type: 2,
        ...prep(config)
    });
}

async function paymentHistory(config, coin) {
    return query('api/paymentHistoryV2.htm', {
        coin: coin.toUpperCase(),
        pageEnable: 0,
        type: 'recv',
        ...prep(config)
    });
}

function unitToFactor(uint) {
    if (uint == 'EH') {
        return 1000000000000000000;
    }
    if (uint == 'PH') {
        return 1000000000000000;
    }
    if (uint == 'TH') {
        return 1000000000000;
    }
    if (uint == 'GH') {
        return 1000000000;
    }
    if (uint == 'MH') {
        return 1000000;
    }
    if (uint == 'KH') {
        return 1000;
    }
    return 1;
}

async function getRewardPerTHV2(config, coin, date) {
    assert(sameDay(date, token.yesterday()), 'invalid date');
    const coinConfig = config[coin.toLowerCase()];
    const overview = await accountOverview(config, coin);
    const factor = unitToFactor(coinConfig.unit);
    const hashrate = overview.hsLast1d / factor;
    const base = 10 ** coinConfig.decimals;
    const reward = overview.yesterdayAmount * base;
    return {
        hashrate: {value: hashrate, uint: coinConfig.unit},
        totalEarned: reward,
        tokenValue: Math.floor(reward / hashrate)
    };
}

async function getRewardPerTHV3(config, coin, date) {
    assert(sameDay(date, token.yesterday()), 'invalid date');
    const coinConfig = config[coin.toLowerCase()];
    const overview = await accountOverview(config, coin);
    const reward = overview.yesterdayAmount * coinConfig.factor;
    const hashrate = await computeHashrate(config, coin, date);
    return {
        hashrate: hashrate,
        totalEarned: reward,
        tokenValue: Math.floor(reward / hashrate.value)
    };
}

async function computeHashrate(config, coin, date) {
    const hashrate = await userHashrateChart(config, coin, date);
    const poolSpeedBeanList = hashrate.poolSpeedBeanList;
    const total = 0, count = 0;
    for (let { timestamp, speed } of hashrate.poolSpeedBeanList) {
        if (sameDay(new Date(timestamp), date)) {
            total += speed;
            count += 1;
        }
    }
    const avg = total / count;
    const factor = unitToFactor(hashrate.unit) / unitToFactor(coinConfig.unit);
    return {
        value: avg * factor,
        unit: coinConfig.unit
    };
}

module.exports = {
    getRewardPerTHV2: getRewardPerTHV2,
    getRewardPerTHV3: getRewardPerTHV3,
    account: account,
    paymentHistory: paymentHistory,
    userHashrateChart: userHashrateChart
}

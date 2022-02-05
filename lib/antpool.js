const assert = require("assert");
const common = require("./common.js");
const time = require("./time.js");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');

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

async function query(config, endpoint, data, method) {
    const qs = new URLSearchParams(data);
    const instace = axios.create();
    const response = await instace.request({
        url: `${config.api}${endpoint}?${qs.toString()}`,
        method: 'POST'
    });
    assert(
        response.status == 200 && response.data.code == 0,
        'Respones error: ' + JSON.stringify(response.data)
    );
    return response.data.data;
}

async function hashrate(config, coin) {
    return query(config, 'hashrate.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function account(config, coin) {
    return query(config, 'account.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function accountOverview(config, coin) {
    return query(config, 'accountOverview.htm', {
        coin: coin.toUpperCase(),
        userId: config.userId,
        ...prep(config)
    });
}

async function calculate(config, coin) {
    return query(config, 'coinCalculator.htm', {
        coinType: coin.toUpperCase(),
        feePercent: config.feePercent,
        hashInput: 1000000000000,
        ...prep(config)
    });
}

async function userHashrateChart(config, coin, date) {
    return query(config, 'userHashrateChart.htm', {
        coinType: coin.toUpperCase(),
        userId: config.userId,
        date: date,
        type: 2, // daily hashrate, 24 data points, 1 hour each
        ...prep(config)
    });
}

async function paymentHistoryV2(config, coin) {
    return query(config, 'paymentHistoryV2.htm', {
        coin: coin.toUpperCase(),
        pageEnable: 0,
        type: 'recv',
        ...prep(config)
    });
}

function unitToFactor(unit) {
    if (unit == 'EH' || unit == 'EH/s') {
        return 1000000000000000000;
    }
    if (unit == 'PH' || unit == 'PH/s') {
        return 1000000000000000;
    }
    if (unit == 'TH' || unit == 'TH/s') {
        return 1000000000000;
    }
    if (unit == 'GH' || unit == 'GH/s') {
        return 1000000000;
    }
    if (unit == 'MH' || unit == 'MH/s') {
        return 1000000;
    }
    if (unit == 'KH' || unit == 'KH/s') {
        return 1000;
    }
    return 1;
}

async function statsYesterday(config, coin) {
    const acc = await account(config, coin);
    const startOfYesterday = time.startOfDay(time.yesterday());
    const settleTime = time.startOfDay(new Date(acc.settleTime));
    assert(
        startOfYesterday == settleTime,
        `Error: not settled yet, last settled time is ${acc.settleTime}`
    );
    const endOfYesterday = new Date().toISOString().split('T')[0] + ' 00:00:00';
    return {
        hashrate: await computeHashrate(
            config, coin, endOfYesterday
        ),
        totalEarned: parseFloat(acc.earn24Hours),
        settledTime: acc.settleTime
    };
}

async function stats(config, coin, dayEnd) {
    const history = await paymentHistoryV2(config, coin);
    for (let record of history.rows) {
        const dayStart = time.startOfDay(new Date(record.timestamp));
        if (dayEnd - 86400 == dayStart) {
            const earning = parseFloat(
                record.fppsBlockAmount
            ) + parseFloat(record.fppsFeeAmount);
            return {
                hashrate: parseFloat(record.hashrate_unit),
                totalEarned: earning,
                settledTime: record.timestamp
            }
        }
    }
    throw 'Pool stats not found';
}

async function computeHashrate(config, coin, date) {
    const hashrate = await userHashrateChart(config, coin, date);
    assert(hashrate.length == 1, 'hashrate mismatch');
    const poolSpeedBeanList = hashrate[0].poolSpeedBeanList;
    var total = 0, count = 0;
    for (let { timestamp, speed } of poolSpeedBeanList) {
        total += speed;
        count += 1;
    }
    return total * unitToFactor(hashrate[0].unit) / count;
}

module.exports = {
    stats,
    statsYesterday
}

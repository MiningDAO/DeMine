const assert = require("assert");
const utils = require("./utils.js");
const time = require("./time.js");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const BigNumber = require('bignumber.js');
const logger = require('./logger');

const axios = require('axios');
const axiosRetry = require('axios-retry');
const { isNetworkOrIdempotentRequestError } = axiosRetry;

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
    axiosRetry(
        instace,
        {
            retries: 3,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (e) => {
                logger.error('axios query error: ' + JSON.stringify(e));
                return isNetworkOrIdempotentRequestError(e)
                    || e.response == undefined
                    || e.response.status != 200;
            }
        }
    );
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

const hashrate = utils.memoize(
    'antpool-hashrate',
    30000,
    async (config, coin) => {
        return query(config, 'hashrate.htm', {
            coin: coin.toUpperCase(),
            userId: config.userId,
            ...prep(config)
        });
    }
);

const account = utils.memoize(
    'antpool-account',
    30000,
    async (config, coin) => {
        return query(config, 'account.htm', {
            coin: coin.toUpperCase(),
            userId: config.userId,
            ...prep(config)
        });
    }
);

const accountOverview = utils.memoize(
    'antpool-accountOverview',
    30000,
    async (config, coin) => {
        return query(config, 'accountOverview.htm', {
            coin: coin.toUpperCase(),
            userId: config.userId,
            ...prep(config)
        });
    }
);

const userHashrateChart = utils.memoize(
    'antpool-userHashrateChart',
    30000,
    async (config, coin, date) => {
        return query(config, 'userHashrateChart.htm', {
            coinType: coin.toUpperCase(),
            userId: config.userId,
            date: date,
            type: 2, // daily hashrate, 24 data points, 1 hour each
            ...prep(config)
        });
    }
);

const paymentHistoryV2 = utils.memoize(
    'antpool-paymentHistoryV2',
    30000,
    async (config, coin, page, pageSize) => {
        return query(config, 'paymentHistoryV2.htm', {
            coin: coin.toUpperCase(),
            type: 'recv',
            pageSize: pageSize,
            page: page,
            ...prep(config)
        });
    }
);

function unitToFactor(unit) {
    if (unit == 'EH' || unit == 'EH/s') {
        return new BigNumber('1e+18');
    }
    if (unit == 'PH' || unit == 'PH/s') {
        return new BigNumber('1e+15');
    }
    if (unit == 'TH' || unit == 'TH/s') {
        return new BigNumber('1e+12');
    }
    if (unit == 'GH' || unit == 'GH/s') {
        return new BigNumber('1e+9');
    }
    if (unit == 'MH' || unit == 'MH/s') {
        return new BigNumber('1e+6');
    }
    if (unit == 'KH' || unit == 'KH/s') {
        return new BigNumber('1e+3');
    }
    return 1;
}

// This function uses account and userHashrateChart API while stats function
// use paymentHistoryV2 API. We see minor difference between results of these
// two and we decided to follow result of paymentHistoryV2. Please be aware of
// the difference if you are using this function.
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
        totalEarnedDecimal: new BigNumber(acc.earn24Hours),
        settleTime: acc.settleTime
    };
}

async function computeHashrate(config, coin, date) {
    const hashrate = await userHashrateChart(config, coin, date);
    assert(hashrate.length == 1, 'hashrate mismatch');
    const poolSpeedBeanList = hashrate[0].poolSpeedBeanList;
    var total = new BigNumber(0), count = 0;
    for (let { timestamp, speed } of poolSpeedBeanList) {
        total = total.plus(speed);
        count += 1;
    }
    return total.times(
        unitToFactor(hashrate[0].unit)
    ).dividedBy(count);
}

function genStats(record) {
    const earning = new BigNumber(
        record.fppsBlockAmount
    ).plus(record.fppsFeeAmount);
    return {
        hashrate: new BigNumber(record.hashrate_unit),
        totalEarnedDecimal: earning,
        settleTime: record.timestamp
    }
}

async function stats(config, coin, dayEnd) {
    const last = await paymentHistoryV2(config, coin, 1, 1);
    assert(
        last.rows.length == 1,
        `No pool stats exists: no record, ` +
        `first history record is ${JSON.stringify(last)}`
    );

    const lastRecord = last.rows[0];
    const lastDayStart = time.startOfDay(
        new Date(lastRecord.timestamp + 'Z')
    );
    assert(
        dayEnd <= lastDayStart + 86400,
        `Pool stats not ready yet: last history ` +
        `record is ${JSON.stringify(last)}, dayEnd is ${dayEnd}`
    );

    if (dayEnd == lastDayStart + 86400) {
        return genStats(lastRecord);
    }

    const page = (lastDayStart - dayEnd) / 86400 + 2;
    assert(
        page <= last.totalRecord,
        `Pool stats not found: last record is ${JSON.stringify(last)}` +
        `, dayEnd is ${dayEnd}, computed page is ${page}`
    );
    const history = await paymentHistoryV2(config, coin, page, 1);
    const record = history.rows[0];
    const dayStart = time.startOfDay(
        new Date(record.timestamp + 'Z')
    );
    assert(
        dayEnd - 86400 == dayStart,
        `Time mismatch: history=${JSON.stringify(history)}, dayEnd=${dayEnd}`
    );
    return genStats(record);
}

module.exports = {
    stats,
    statsYesterday,
    hashrate,
    unitToFactor,
    paymentHistoryV2,
}

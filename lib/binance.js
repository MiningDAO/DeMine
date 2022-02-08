const assert = require("assert");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const logger = require('./logger');

const axios = require('axios');
const axiosRetry = require('axios-retry');
axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay});

function binanceConfig(hre) {
    assert(
        hre.network.name == 'bsc' || hre.network.name == 'bscdev',
        'Error: Only bsc and bscdev network are supported'
    );
    return hre.network.name == 'bsc'
        ? hre.localConfig.binance.prod
        : hre.localConfig.binance.test;
}

function signature(config, qsString) {
    return createHmac(
        'sha256', config.secret
    ).update(qsString).digest('hex').toUpperCase();
}

async function query(config, endpoint, method, data) {
    const qs = new URLSearchParams(data);
    const qsString = qs.toString();
    const instace = axios.create();
    axiosRetry(instace, { retries: 3 });
    const response = await instace.request({
        url: `${config.api}${endpoint}?${qs.toString()}`,
        method: method
    });
    assert(
        response.status == 200,
        'Respones error: ' + JSON.stringify(response.data)
    );
    return response.data;
}

async function querySigned(config, endpoint, method, data) {
    const qs = new URLSearchParams(data);
    const qsString = qs.toString();
    const sig = createHmac(
        'sha256', config.secret
    ).update(qsString).digest('hex').toUpperCase();
    const instace = axios.create({
        headers: {
            post: {
                "X-MBX-APIKEY": config.key
            },
            get: {
                "X-MBX-APIKEY": config.key
            }
        }
    });
    const response = await instace.request({
        url: `${config.api}${endpoint}?${qsString}&signature=${sig}`,
        method: method
    });
    assert(
        response.status == 200,
        'Respones error: ' + JSON.stringify(response.data)
    );
      return response.data;
}

async function ping() {
    return await query('ping', 'GET', {});
}

async function time() {
    const response = await query('time', 'GET', {});
    return response.serverTime;
}

async function withdraw(config, data) {
    const response = await querySigned(
        config,
        "/sapi/v1/capital/withdraw/apply",
        "POST",
        {
            coin: data.coin,
            network: "BSC", // BSC network
            address: data.address,
            amount: data.amount,
            timestamp: new Data().getTime()
        }
    );
    return response.id;
}

async function balanceOf(config) {
    const response = await querySigned(
        config,
        "/api/v3/account",
        "GET",
        { timestamp: new Date().getTime() }
    );
    const balance = response.balances.find(b => b.asset == coin);
    return balance.free;
}

async function withdrawAll(hre, coin, to) {
    const config = binanceConfig(hre);
    const balance = await binance.balanceOf(
        config,
        coin.toUpperCase()
    ); // string
    logger.info("Withdraw Info:");
    logger.info(JSON.stringify({
        from: 'binance',
        'to': to,
        'binanceBalance': balance,
        'amountToWithdraw': balance
    }, null, 2));
    if (new BigNumber(balance).eq(0)) {
        logger.warning('No balance to withdraw');
        return;
    }
    await common.run(async function() {
        return await binance.withdraw(
            config,
            {
                coin: coin.toUpperCase(),
                network: hre.network.name.toUpperCase(),
                address: to,
                amount: balance
            }
        );
    });
}

module.exports = {
    balanceOf: balanceOf,
    withdrawAll: withdrawAll
}

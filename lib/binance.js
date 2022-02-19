const assert = require("assert");
const BigNumber = require('bignumber.js');
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');
const axiosRetry = require('axios-retry');

const utils = require("./utils.js");
const logger = require('./logger');

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
    axiosRetry(
        instace,
        {
            retries: 3,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                return error.response.status == 200;
            }
        }
    );
    const response = await instace.request({
        url: `${config.api}${endpoint}?${qs.toString()}`,
        method: method
    });
    assert(
        response.status == 200,
        'Respones error: ' + JSON.stringify(response.data)
    );
    logger.debug(response.data);
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

async function withdrawHistory(config, data) {
    const response = await querySigned(
        config,
        "/sapi/v1/capital/withdraw/history",
        "GET",
        {
            coin: data.coin,
            network: 'BSC',
            address: data.address,
            timestamp: new Date().getTime()
        }
    );
    return response;
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
            timestamp: new Date().getTime()
        }
    );
    return response.id;
}

async function balanceOf(config, coin) {
    const response = await querySigned(
        config,
        "/api/v3/account",
        "GET",
        { timestamp: new Date().getTime() }
    );
    const balance = response.balances.find(b => b.asset == coin);
    return balance.free;
}

async function withdrawAll(hre, coin, to, skipPrompts=false) {
    const config = binanceConfig(hre);
    const balance = await balanceOf(
        config,
        coin.toUpperCase()
    ); // string
    logger.info("Withdraw Info:");
    logger.info(JSON.stringify({
        from: 'binance',
        'to': to,
        'coin': coin,
        'network': hre.network.name,
        'binanceBalance': balance,
        'amountToWithdraw': balance
    }, null, 2));
    if (new BigNumber(balance).eq(0)) {
        logger.warn('No balance to withdraw');
        return;
    }
    const startTime = new Date().getTime();
    const func = async() => {
        return await withdraw(
            config,
            {
                coin: coin.toUpperCase(),
                address: to,
                amount: balance
            }
        );
    };
    const id = skipPrompts ? await func() : await utils.prompts(func);
    logger.info(`Withdraw done: id=${id}`);
    logger.info(`Sleeping 30s to wait for the tx`);
    await utils.sleep(60000); // sleep 1min to query the info

    const history = await withdrawHistory(config, {
        coin: coin,
        address: to,
        startTime: startTime,
    });
    const tx = history.find(h => h.id == id);
    logger.info(`Detailed withdraw info: ` + JSON.stringify(tx, null, 2));
}

module.exports = {
    balanceOf: balanceOf,
    withdrawAll: withdrawAll,
}

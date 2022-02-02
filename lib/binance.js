const assert = require("assert");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');
const API_URL = '';

function signature(config, qsString) {
    return createHmac(
        'sha256', config.secret
    ).update(qsString).digest('hex').toUpperCase();
}

async function query(config, endpoint, method, data) {
    const qs = new URLSearchParams(data);
    const qsString = qs.toString();
    const instace = axios.create();
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

module.exports = {
    balanceOf: balanceOf,
    withdraw: withdraw
}

const assert = require("assert");
const { createHmac } = require('crypto');
const { URLSearchParams } = require('url');
const axios = require('axios');
const API_URL = 'https://api.binance.com';

function signature(config, qsString) {
    return createHmac(
        'sha256', config.secret
    ).update(qsString).digest('hex').toUpperCase();
}

async function query(endpoint, method, data) {
    const qs = new URLSearchParams(data);
    const qsString = qs.toString();
    const instace = axios.create();
    const response = await instace.request({
        url: `${API_URL}${endpoint}?${qs.toString()}`,
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
        url: `${API_URL}${endpoint}?${qsString}&signature=${sig}`,
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

async function withdraw(localConfig, data) {
    const response = await querySigned(
        localConfig.binance,
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

async function accountStatus(localConfig, coin) {
    const response = await querySigned(
        localConfig.binance,
        "/sapi/v1/account/status",
        "GET",
        { timestamp: new Date().getTime() }
    );
    return response;
}

async function assetDetails(localConfig, coin) {
    const response = await querySigned(
        localConfig.binance,
        "/sapi/v1/asset/assetDetail",
        "GET",
        { timestamp: new Date().getTime() }
    );
    return response;
}

module.exports = {
    accountStatus: accountStatus,
    assetDetails: assetDetails,
    withdraw: withdraw
}

const { ethers } = require("ethers");
const BigNumber = require("bignumber.js");
const token = require('../../../../../lib/token.js');
const { key, redis } = require('../../../../../lib/redis.js');

export default async (req, res) => {
    const { param } = req.query;
    if (param.length != 3) {
        res.json({ok: false, message: 'invalid path'});
        return;
    }
    const network = param[0].toLowerCase();
    const coin = param[1].toLowerCase();

    var id, decoded;
    try {
        id = ethers.BigNumber.from(param[2]);
        decoded = token.decodeOne(id);
    } catch(err) {
        console.log(`invalid input coin=${coin},network=${network},id=${id}`);
        res.json({ok: false, message: 'invalid input'});
        return;
    }

    const contractKey = key(network, coin, 'contract');
    const contractStored = await redis.get(contractKey);
    if (contractStored === null || contractStored === undefined) {
        console.log(`invalid request: network=${network}, coin=${coin}`);
        res.json({ok: false, message: 'nft contract not found'});
        return;
    }

    const contract = JSON.parse(contractStored);
    const decimals = contract.earningToken.decimals;
    const base = new BigNumber(10).pow(decimals);

    var totalEarning = new BigNumber(0);
    for (let i = decoded.startTs + 86400; i <= decoded.endTs; i += 86400) {
        const earningKey = key(network, coin, 'earning', i);
        const earning = await redis.get(earningKey) || 0;
        totalEarning = totalEarning.plus(new BigNumber(earning));
    }

    var hex = id.toHexString().substr(2);
    if (hex.length < 64) {
        hex = '0x' + '0'.repeat(64 - hex.length) + hex.toLowerCase();
    }

    console.log(`request from ${network} for ${coin}`);
    res.json({
        name: `DeMine${coin.toUpperCase()}`,
        description: `Earning from ${decoded.startDate} to ${decoded.endDate}`,
        image: `https://api.hypertrons.com/static/${coin}.jpg`,
        properties: {
            id: {
                hex: hex,
                type: decoded.type,
                ...decoded
            },
            earningToken: contract.earningToken,
            finalized: decoded.endTs <= contract.finalized,
            earning: totalEarning.div(base),
        }
    });
};

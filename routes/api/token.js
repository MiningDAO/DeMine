const { ethers } = require("ethers");
const express = require("express");
const router = express.Router();
const BigNumber = require("bignumber.js");
const token = require('../../lib/token.js');
const { key, redis } = require('../../lib/redis.js');

function genType(startTs, endTs) {
    if (endTs - startTs == 86400) {
        return 'daily';
    }
    if (endTs - startTs == 86400 * 7) {
        return 'weekly';
    }
    if (endTs - startTs == 86400 * 14) {
        return 'biweekly';
    }
    throw 'Invalid token id';
}

router.get("/:network/:coin/:id", async (req, res) => {
    const coin = req.params.coin.toLowerCase();
    const network = req.params.network.toLowerCase();
    const id = ethers.BigNumber.from(req.params.id);
    const decoded = token.decodeOne(id);

    const contractKey = key(network, coin, 'contract');
    const contractStored = await redis.get(contractKey);
    if (contractStored === null || contractStored === undefined) {
        res.json({ok: false, message: 'nft contract not found'});
    }

    const contract = JSON.parse(contractStored);
    const decimals = contract.earningToken.decimals;
    const base = new BigNumber(10).pow(decimals);

    var totalEarning = new BigNumber(0);
    for (let i = decoded.startTs + 86400; i <= decoded.endTs; i += 86400) {
        const earningKey = key(network, coin, 'earning', i);
        const earning = await redis.get(earningKey);
        totalEarning = totalEarning.plus(new BigNumber(earning));
    }

    var hex = id.toHexString().substr(2);
    if (hex.length < 64) {
        hex = '0x' + '0'.repeat(64 - hex.length) + hex.toLowerCase();
    }

    res.json({
        name: `DeMine${coin.toUpperCase()}`,
        description: `Earning from ${decoded.startDate} to ${decoded.endDate}`,
        properties: {
            id: {
                hex: hex,
                type: genType(decoded.startTs, decoded.endTs),
                ...decoded
            },
            earningToken: contract.earningToken,
            finalized: decoded.endTs <= contract.finalized,
            earning: totalEarning.div(base),
        }
    });
});

module.exports = router;

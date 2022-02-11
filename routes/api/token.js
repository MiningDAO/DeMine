const express = require("express");
const router = express.Router();
const BigNumber = require("bignumber.js");
const token = require('../../lib/token.js');
const state = require('../../lib/state.js');
const { key, redis } = require('../../lib/bootstrap.js');

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

router.get("/:coin/:id", async (req, res) => {
    const coin = req.params.coin.toLowerCase();
    const id = ethers.BigNumber.from(req.params.id);
    const decoded = token.decodeOne(id);
    const type = genType(decoded.startTs, decoded.endTs);

    const contractKey = key(hre.network.name, coin, 'contract');
    const contract = JSON.parse(await redis.get(contractKey));
    const decimals = contract.earningToken.decimals;
    const base = new BigNumber(10).pow(decimals);

    var totalEarning = new BigNumber(0);
    for (let i = decoded.startTs + 86400; i <= decoded.endTs; i += 86400) {
        const earningKey = key(hre.network.name, coin, 'earning', i);
        const earning = await redis.get(earningKey);
        totalEarning = totalEarning.plus(new BigNumber(earning));
    }

    res.json({
        coin: coin,
        id: {
            hex: id.toHexString(),
            ...decoded
        },
        type: type,
        finalized: decoded.endTs <= contract.finalized,
        earning: totalEarning.div(base).toFixed(8),
        earningToken: contract.earningToken,
    });
});

module.exports = router;

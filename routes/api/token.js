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
    const type = genType(decoded.startTs, decoded.endTs);

    const contractKey = key(network, coin, 'contract');
    const contractStored = await redis.get(contractKey);
    if (contractStored == null or contractStored == undefined) {
        res.json({ok: false, message: 'nft contract not found'});
    }

    const contract = JSON.parse();
    const decimals = contract.earningToken.decimals;
    const base = new BigNumber(10).pow(decimals);

    var totalEarning = new BigNumber(0);
    for (let i = decoded.startTs + 86400; i <= decoded.endTs; i += 86400) {
        const earningKey = key(hre.network.name, coin, 'earning', i);
        const earning = await redis.get(earningKey);
        totalEarning = totalEarning.plus(new BigNumber(earning));
    }

    res.json({
        ok: true,
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

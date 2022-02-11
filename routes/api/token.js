const express = require("express");
const router = express.Router();
const BigNumber = require("bignumber.js");
const token = require('../../lib/token.js');
const state = require('../../lib/state.js');

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

    const base = new BigNumber(10).pow(decimals);
    const normalizedEarning = new BigNumber(earning.toString()).div(base);

    res.json({
        coin: coin,
        hex: id.toHexString(),
        type: type,
        finalized: decoded.endTs <= finalized,
        earning: normalizedEarning.toFixed(8),
        earningToken: earningToken.address,
        ...decoded
    });
});

module.exports = router;

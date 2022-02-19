const { ethers } = require("ethers");
const BigNumber = require("bignumber.js");
const token = require('../../../../../lib/token.js');
const { key, redis } = require('../../../../../lib/redis.js');

export default async (req, res) => {
    const { param } = req.query;
    if (param.length != 2) {
        res.json({ok: false, message: 'invalid path'});
        return;
    }
    const network = param[0].toLowerCase();
    const coin = param[1].toLowerCase();

    const earningKey = key(network, coin, 'earning');
    const earningMap = await redis.get(earningKey);
    if (earningMap === null || earningMap === undefined) {
        res.json({ok: false, message: 'earning map not found'});
        return;
    }

    const earning = JSON.parse(earningMap);
    return res.json({ok: true, ...earning});
}

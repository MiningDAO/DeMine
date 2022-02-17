const { ethers } = require("ethers");
const express = require("express");
const router = express.Router();
const BigNumber = require("bignumber.js");
const token = require('../../../lib/token.js');
const { key, redis } = require('../../../lib/redis.js');

router.get("/:network/:coin", async (req, res) => {
    const coin = req.params.coin.toLowerCase();
    const network = req.params.network.toLowerCase();

    const contractKey = key(network, coin, 'contract');
    const contractStored = await redis.get(contractKey);
    if (contractStored === null || contractStored === undefined) {
        console.log(`invalid request: network=${network}, coin=${coin}`);
        res.json({ok: false, message: 'nft contract not found'});
        return;
    }

    const contract = JSON.parse(contractStored);
    return res.json({
        ok: true,
        address: contract.address,
        earningToken: contract.earningToken,
        abi: contract.abi
    });
});

module.exports = router;

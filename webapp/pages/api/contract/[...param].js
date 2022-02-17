const { ethers } = require("ethers");
const BigNumber = require("bignumber.js");
const token = require('../../../../lib/token.js');
const { key, redis } = require('../../../../lib/redis.js');

export default async (req, res) => {
    const { param } = req.query;
    if (param.length != 2) {
        res.json({ok: false, message: 'invalid path'});
        return;
    }
    const network = param[0].toLowerCase();
    const coin = param[1].toLowerCase();

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
}

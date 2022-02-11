const { ethers } = hre = require("hardhat");
const state = require('./state.js');
const time = require('./time.js');
const token = require('./token.js');

function key(...args) {
    return args.join('.');
}

async function load(coin, redis) {
    console.log(`Bootstraping ${coin} ...`);
    const network = hre.network.name;
    const nft = state.loadNFTClone(hre, coin).target;

    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );

    console.log(`Loading earning map...`);
    const earning = state.tryLoadEarning(hre, coin);
    if (earning.first == undefined) {
        earning.first = time.toEpoch(new Date('2022-02-01T00:00:00Z'));
        earning.last = earning.first;
    }
    earning.earning = earning.earning || {};
    const finalized = (await erc1155.finalized()).toNumber();
    if (earning.last < finalized) {
        console.log(`Updating earning map...`);
        for (let i = earning.last; i < finalized; i += 86400) {
            const id = token.genTokenId(i, 'daily');
            const earned = await erc1155.earning(
                token.encodeOne(ethers, id)
            );
            earning.earning[id.endTs] = earned.toString();
        }
        earning.last = finalized;
    }
    state.updateEarning(hre, coin, earning);
    console.log(`Earning map updated...`);

    for (
        let i = earning.first + 86400;
        i <= earning.last;
        i += 86400
    ) {
        await redis.set(key(network, coin, 'earning', i), earning.earning[i]);
    }

    await redis.set(key(network, coin, 'contract'), JSON.stringify({
        address: nft,
        finalized: finalized,
        earningToken: {
            address: earningToken.address,
            name: await earningToken.name(),
            symbol: await earningToken.symbol(),
            decimals: await earningToken.decimals(),
        }
    }));
}

const redis = require('redis').createClient();
redis.on('error', (err) => console.log('Redis Client Error', err));
(async() => {
    await redis.connect();
    await load('btc', redis);
    console.log('Redis ready');
})();

module.exports = {key, redis, load};

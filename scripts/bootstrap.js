const { ethers, artifacts } = hre = require("hardhat");
const state = require('../lib/state.js');
const time = require('../lib/time.js');
const token = require('../lib/token.js');
const logger = require('../lib/logger.js');
const { key } = require('../lib/redis.js');

async function abi() {
    var abi1 = await hre.run('abi', {contract: 'ERC1155Facet'});
    const abi2 = await hre.run('abi', {contract: 'Diamond'});
    const names = abi2.map(a => a.name);
    abi1 = abi1.filter(a => !names.includes(a.name));
    return abi2.concat(abi1);
}

async function load(coin, redis) {
    logger.info(`Bootstraping ${coin} ...`);
    const network = hre.network.name;

    logger.info(`Loading contract metadata...`);
    const nft = state.loadNFTClone(hre, coin).target;
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );
    const finalized = (await erc1155.finalized()).toNumber();
    await redis.set(key(network, coin, 'contract'), JSON.stringify({
        address: nft,
        finalized: finalized,
        earningToken: {
            address: earningToken.address,
            name: await earningToken.name(),
            symbol: await earningToken.symbol(),
            decimals: await earningToken.decimals(),
        },
        abi: await abi()
    }));
    logger.info(`Contract metadata updated...`);

    logger.info(`Loading earning map...`);
    const earning = state.tryLoadEarning(hre, coin);
    if (earning.first == undefined) {
        earning.first = time.toEpoch(new Date('2022-02-01T00:00:00Z'));
        earning.last = earning.first;
    }
    earning.earning = earning.earning || {};
    if (earning.last < finalized) {
        logger.info(`Updating earning map...`);
        for (let i = earning.last; i < finalized; i += 86400) {
            const id = token.genTokenId(i, 'daily');
            const encoded = token.encodeOne(id);
            const earned = await erc1155.earning(encoded);
            earning.earning[id.endTs] = earned.toString();
        }
        earning.last = finalized;
    }
    state.updateEarning(hre, coin, earning);
    logger.info(`Earning map saved at local...`);
    for (
        let i = earning.first + 86400;
        i <= earning.last;
        i += 86400
    ) {
        // save per token earning
        const tokenEarningKey = key(network, coin, 'earning', i);
        await redis.set(tokenEarningKey, earning.earning[i]);
    }
    // save the whole earning map
    const earningKey = key(network, coin, 'earning');
    await redis.set(earningKey, JSON.stringify(earning));
    logger.info(`Earning map updated...`);
}

async function main() {
    const redis = require('redis').createClient();
    await redis.connect();
    await load('btc', redis);
    logger.info('Bootstrap done');
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        logger.error(error);
        process.exit(1);
    });

const { ethers } = hre = require("hardhat");

function key(network, coin, key) {
    return [network, coin, key].join('.');
}

async function boostrap(coin, redis) {
    const network = hre.network.name;
    const nft = state.loadNFTClone(hre, coin).target;

    const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );

    const earning = tryLoadEarning(hre, coin);
    const finalized = await erc1155Facet.finalized();
    if (earning.latest == undefined || earning.latest < finalized) {
        for (let i = earning.latest + 86400, i <= finalized; i++) {
            earning.data[i] = 
        }
        earning.latest = finalized;
    }

    const earning = await erc1155Facet.earning(id);

    await redis.set(key(network, coin, 'contract'), {
        address: nft,
        finalized: finalized.toString(),
        earningToken: {
            address: earningToken.address,
            name: await earningToken.name(),
            symbol: await earningToken.symbol(),
            decimals: await earningToken.decimals(),
        },
        earning: earning.data
    });
}

const redis = require('redis').createClient();
client.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

redis.set('', nft)

module.exports = redis;

const { ethers } = hre = require("hardhat");

function key(network, coin, key) {
    return [network, coin, key].join('.');
}

async function boostrap(coin, redis) {
    const network = hre.network.name;
    const nft = state.loadNFTClone(hre, coin).target;

    const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
    const finalized = await erc1155Facet.finalized();
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );
    const decimals = await earningTokne.decimals();
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
        earning: {}
    });
}

const redis = require('redis').createClient();
client.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

redis.set('', nft)

module.exports = redis;

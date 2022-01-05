const { ethers } = require('hardhat');
const config = require('../config');

async function main() {
    const { tokenFactory } = config[network.name];
    await hre.run( "cloneToken", {
        factory: tokenFactory,
        name: 'DeMine Test USD Token',
        symbol: 'DMTU',
        decimals: 6
    });
    await hre.run( "cloneToken", {
        factory: tokenFactory,
        name: 'DeMine Test DAI Token',
        symbol: 'DMTD',
        decimals: 6
    });
    await hre.run( "cloneToken", {
        factory: tokenFactory,
        name: 'DeMine Test Reward Token',
        symbol: 'DMTR',
        decimals: 6
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

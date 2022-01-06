const { network, localConfig } = require('hardhat');

async function main() {
    if (localConfig[network.name]) {
        const { tokenFactory } = localConfig[network.name];
        await hre.run("clone-token", {
            factory: tokenFactory.address,
            name: 'DeMine Test USD Token',
            symbol: 'DMTU',
            decimals: 6
        });
        await hre.run("clone-token", {
            factory: tokenFactory.address,
            name: 'DeMine Test DAI Token',
            symbol: 'DMTD',
            decimals: 6
        });
        await hre.run("clone-token", {
            factory: tokenFactory.address,
            name: 'DeMine Test Reward Token',
            symbol: 'DMTR',
            decimals: 6
        });
    } else {
        await hre.run("clone-token", {
            name: 'DeMine Test USD Token',
            symbol: 'DMTU',
            decimals: 6
        });
        await hre.run("clone-token", {
            name: 'DeMine Test DAI Token',
            symbol: 'DMTD',
            decimals: 6
        });
        await hre.run("clone-token", {
            name: 'DeMine Test Reward Token',
            symbol: 'DMTR',
            decimals: 6
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

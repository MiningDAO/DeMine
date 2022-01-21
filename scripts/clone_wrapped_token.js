const { ethers, deployments, network, localConfig } = require('hardhat');

async function clone(meta) {
    await hre.run('clone-wrapped-token', {
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals
    });
}

async function main() {
    const config = localConfig[network.name] || {};
    const income = localConfig.wrappedTokenMeta.income;
    const payment = localConfig.wrappedTokenMeta.payment;
    config.wrappedToken?.income || await clone(income)
    config.wrappedToken?.payment || await clone(payment)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

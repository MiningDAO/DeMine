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
    const rewardMeta = localConfig.wrappedTokenMeta.reward;
    const paymentMetas = localConfig.wrappedTokenMeta.payments;
    config.wrappedToken?.reward || await clone(rewardMeta)
    config.wrappedToken?.payments || await Promise.all(
        paymentMetas.map(p => clone(p))
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

const { ethers, network, localConfig } = require('hardhat');

async function main() {
    if (localConfig[network.name]) {
        const { factory } = localConfig[network.name];
        await hre.run("clone-demine", { factory: factory.address });
    } else {
        await hre.run("clone-demine", {});
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

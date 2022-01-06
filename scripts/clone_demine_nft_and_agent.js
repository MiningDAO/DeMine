const { ethers, network, localConfig } = require('hardhat');

async function main() {
    await hre.run("clone-demine", {});
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

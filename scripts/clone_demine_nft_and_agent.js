const { ethers } = require('hardhat');
const config = require('../config');

async function main() {
    const { factory } = config[network.name];
    await hre.run("clone-demin", { factory: factory });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

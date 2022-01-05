require("@nomiclabs/hardhat-waffle");
require("hardhat-contract-sizer");
const config = require("./config");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    maticdev: {
      url: config.maticdev.alchemy,
      chainId: 80001,
      accounts: config.accounts
    },
    arbitrumdev: {
      url: config.arbitrumdev.alchemy,
      accounts: config.accounts
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 100,
    },
  },
};

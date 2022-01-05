const { ethers } = require("hardhat");
const config = require("../config");

async function main() {
    const [deployer, admin, custodian] = await ethers.getSigners();

    // deploy factory
    const Factory = await ethers.getContractFactory("DeMineCloneFactory");
    const factory = await DeMineFactory.deploy();
    await factory.deployed();

    const NFT = await ethers.getContractFactory("DeMineNFT");
    const Agent = await ethers.getContractFactory("DeMineAgent");

    // deploy nft and agent
    const tx = await factory.create(
      // nft
      config.tokenUri,
      custodian.address,
      config.royaltyBps
      config[network.name].wbtc,
      // admin
      [
          config[network.name].usdt,
          config[network.name].usdc
      ],
      custodian.address,
      // owner
      admin.address
    );
    const { events: events } = await tx.wait();
    const { args: [nft, agent] } = events.find(
      function(e) { return e.event === 'Clone'; }
    );
    console.log("nft contract is deployed at: " + nft);
    console.log("agent contract is deployed at: " + agent);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

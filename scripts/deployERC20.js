const { ethers } = require("hardhat");
const config = require("../config");

async function deployOne(factory, name, symbol, decimal, owner) {
    const tx = await factory.create(name, symbol, decimal, owner.address);
    const { events: events } = await tx.wait();
    const { args: [address] } = events.find(
      function(e) { return e.event === 'Clone'; }
    );
    console.log("ERC20 token " + symbol + " is deployed at: " + address);
}

async function main() {
    const [deployer, admin, custodian] = await ethers.getSigners();

    // deploy factory
    const Factory = await ethers.getContractFactory("WrappedTokenCloneFactory");
    const factory = await DeMineFactory.deploy();
    await factory.deployed();
    console.log("Wrapped Token Clone Factory: " + factory.address);

    // deploy ERC20 tokens
    await deplyOne("DMT USD Coin", "DMTU", 6, admin);
    await deplyOne("DMT DAI Coin", "DMTD", 6, admin);
    await deplyOne("DMT Reward Coin", "DMTR", 8, admin);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

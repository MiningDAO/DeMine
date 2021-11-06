const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MingingDAOMiners", function () {
  it("Should deployed", async function () {
    const address founder = 0xa4b368e3a9D49Ff15b58f70Fb976724A98B6D149;
    const address investee = 0xEF2e3F91209F88A3143e36Be10D52502162426B3;

    const MiningDAO = await ethers.getContractFactory("MiningDAOMinerNFT");
    const miningDAO = await upgrades.deployProxy(MiningDAO, [founder, investee]);

    await miningDAO.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DeMineNFT", function () {
  it("Should deployed", async function () {
    const MiningDAO = await ethers.getContractFactory("DeMineNFT");
    const miningDAO = await MiningDAO.deploy();

    await miningDAO.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");

describe("DeMine Agent", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var contracts;

    before(async function() {
        signers = await utils.signers();
    });

    beforeEach(async function() {
        contracts = await utils.setupDeMine(signers);
    });

    it("only nft functions", async function () {
        await expect(
            agent.connect(admin).setPool(1, user1.address, 1000)
        ).to.be.revertedWith(
            "DeMineAgent: only nft contract allowed"
        );

        const [user1, user2, _] = signers.users;
        let { ids, amounts } = await utils.mintAndRedeem(
            contracts, signers, user1
        );
    });
});

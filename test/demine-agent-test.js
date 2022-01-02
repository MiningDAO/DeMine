const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");

describe("DeMine Agent", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var costTokens;
    var rewardToken;
    var nft;
    var agent;

    before(async function() { signers = await utils.signers(); });

    beforeEach(async function() {
        rewardToken = await utils.setupRewardToken(signers.admin);
        costTokens = await utils.setupPaymentTokens(signers.admin, 3);
        const value = await utils.setupDeMine(
            rewardToken,
            costTokens,
            signers
        );
        nft = value.nft;
        agent = value.agent;
    });

    it("only nft functions", async function () {
        await expect(
            agent.connect(admin).setPool(1, 1000)
        ).to.be.revertedWith(
            "DeMineAgent: only nft contract allowed"
        );
    });
});

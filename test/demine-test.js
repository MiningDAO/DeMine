const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeMine", function () {
    // users
    var user1;
    var user2;
    var admin;
    var costRecipient;
    var royaltyRecipient;

    // contracts
    var rewardToken;
    var costToken;
    var nft;
    var agent;

    before(async function() {
        [
            user1, user2, admin, costRecipient, royaltyRecipient
        ] = await ethers.getSigners();

        // setup token factory
        const TokenFactory = await ethers.getContractFactory("WrappedTokenCloneFactory");
        tokenFactory = await TokenFactory.deploy();
        await tokenFactory.deployed();
        const Token = await ethers.getContractFactory("WrappedToken");

        // setup reward token
        const tx1 = await tokenFactory.create("Reward", "REWARD", 8, admin.address);
        const { events: events1 } = await tx1.wait();
        const { address: address1 } = events1.find(Boolean);
        rewardToken = await Token.attach(address1);

        // setup cost token
        const tx2 = await tokenFactory.create("Cost", "COST", 6, admin.address);
        const { events: events2 } = await tx2.wait();
        const { address: address2 } = events2.find(Boolean);
        costToken = await Token.attach(address2);

        // setup demine factory
        const DeMineFactory = await ethers.getContractFactory("DeMineCloneFactory");
        demineFactory = await DeMineFactory.deploy();
        await demineFactory.deployed();

        // setup nft and agent
        const NFT = await ethers.getContractFactory("DeMineNFT");
        const Agent = await ethers.getContractFactory("DeMineAgent");
        const tx3 = await demineFactory.create(
            // nft
            "some_url",
            royaltyRecipient.address,
            100,
            // agent
            costToken.address,
            costRecipient.address,
            // owner
            admin.address
        );
        const { events: events3 } = await tx3.wait();
        const { args: [nft, agent] } = events3.find(
            function(e) { return e.event === 'NewContract'; }
        );
        nft = await NFT.attach(nft);
        agent = await Agent.attach(agent);
    });

    it("should be ownable", async function () {
    });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeMineNFTAdmin", function () {
    var owner;
    var user1;
    var user2;

    var nftAdminFactory;
    var nftFactory;
    var tokenFactory;

    var admin;
    var rewardToken;
    var costToken;

    before(async function() {
        [user1, user2, owner] = await ethers.getSigners();
        const NFTAdminFactory = await ethers.getContractFactory("DeMineNFTAdminCloneFactory");
        nftAdminFactory = await NFTAdminFactory.deploy();
        await nftAdminFactory.deployed();

        const NFTFactory = await ethers.getContractFactory("DeMineNFTCloneFactory");
        nftFactory = await NFTFactory.deploy();
        await nftFactory.deployed();

        const TokenFactory = await ethers.getContractFactory("WrappedTokenCloneFactory");
        tokenFactory = await TokenFactory.deploy();
        await tokenFactory.deployed();
    });

    beforeEach(async function() {
        const Token = await ethers.getContractFactory("WrappedToken");
        // setup reward token
        const tx1 = await tokenFactory.create("Reward", "REWARD", 8, owner.address);
        const { events: events1 } = await tx1.wait();
        const { address: address1 } = events1.find(Boolean);
        rewardToken = await Token.attach(address1);
        // setup cost token
        const tx2 = await tokenFactory.create("Cost", "COST", 6, owner.address);
        const { events: events2 } = await tx2.wait();
        const { address: address2 } = events2.find(Boolean);
        costToken = await Token.attach(address2);

        // setup nft
        const NFT = await ethers.getContractFactory("DeMineNFT");
        const tx3 = await nftFactory.create(
            "some_url", owner.address, 100, owner.address
        );
        const { events: events3 } = await tx3.wait();
        const { address: address3 } = events3.find(Boolean);
        let nft = NFT.attach(address3);

        // setup nft admin
        const Admin = await ethers.getContractFactory("DeMineNFTAdmin");
        const tx = await nftAdminFactory.create(
            30, // billing period
            nft.address,
            rewardToken.address,
            costToken.address,
            owner.address, // cost recipient
            owner.address // owner
        );
        const { events } = await tx.wait();
        const { address } = events.find(Boolean);
        admin = await Admin.attach(address);
        await nft.connect(owner).transferOwnership(admin.address);

        // initialize token
        rewardToken.connect(owner).mint(user1.address, 100);
        rewardToken.connect(owner).mint(user2.address, 100);
        costToken.connect(owner).mint(user1.address, 100);
        costToken.connect(owner).mint(user2.address, 100);
    });

    it("should be viewable", async function () {
        let [rewardAddr, costAddr] = await admin.treasureSource();
        expect(rewardAddr).to.be.equal(rewardToken.address);
        expect(costAddr).to.be.equal(costToken.address);
    });

    it("should be ownable", async function () {
        const error = "Ownable: caller is not the owner";
        await expect(
            admin.connect(user1).newPool(
                "hash", 1, 10, 1000, 100, user2.address
            )
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).finalizeCycle(1)
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(
                user1
            ).finalizeCycleWithAdjustment(
                1, [1, 2], [100, 100]
            )
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).lock()
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).unlock(1000)
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).resetPoolCost(1, 2)
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(
                user1
            ).batchResetPoolCost([1, 2], [1, 1])
        ).to.be.revertedWith(error);
    });
});

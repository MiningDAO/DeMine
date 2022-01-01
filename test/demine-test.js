const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-utils.js");
const ERC1155 = require("./ERC1155.js");

describe("DeMine", function () {
    // users
    var user1;
    var user2;
    var admin;
    var costRecipient;
    var royaltyRecipient;

    // contracts
    var demineFactory;
    var rewardToken;
    var costToken;
    var nft;
    var agent;

    // state simulator
    var simulator = new ERC1155();

    var checkBalances = async function(users, ids) {
        let balances = await nft.connect(admin).balanceOfBatch(users, ids);
        let expectedBalances = simulator.balanceOfBatch(users, ids);
        expect(balances.length).to.equal(expectedBalances.length);
        for (var i = 0; i < balances.length; i++) {
            expect(balances[i].eq(expectedBalances[i])).to.be.true;
        }
    };

    var createPool = async function(
        pool, info, startCycle, numCycles,
        supplyPerCycle, costPerToken, issuer
    ){
        let { ids, supplies } = utils.newPool(
            pool, startCycle, numCycles, supplyPerCycle
        );
        simulator.mintBatch(agent.address, ids, supplies);
        await expect(
            nft.connect(admin).newPool(
                info, startCycle, numCycles, supplies, costPerToken, issuer
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            admin.address,
            '0x0000000000000000000000000000000000000000',
            agent.address,
            ids,
            supplies
        ).to.emit(nft, "NewPool").withArgs(
            pool, issuer, costPerToken, info
        );
        return ids;
    };

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
    });

    beforeEach(async function() {
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
        const { args: [nftAddr, agentAddr] } = events3.find(
            function(e) { return e.event === 'NewContract'; }
        );
        nft = await NFT.attach(nftAddr);
        agent = await Agent.attach(agentAddr);
        expect(await agent.nft()).to.equal(nft.address);
        expect(await nft.agent()).to.equal(agent.address);
    });

    it("nft should be ownable", async function () {
        const error = "Ownable: caller is not the owner";
        let { ids, supplies } = utils.newPool(0, 10, 130, 1000);
        await expect(
            nft.connect(user1).newPool(
                "hash", 10, 130, supplies, 100, user2.address
            )
        ).to.be.revertedWith(error);

        await expect(
            nft.connect(user1).reward(1)
        ).to.be.revertedWith(error);

        await expect(
            nft.connect(
                user1
            ).rewardWithOverrides(
                1, [1, 2], [100, 100]
            )
        ).to.be.revertedWith(error);

        await expect(
            nft.connect(
                user1
            ).setTokenRoyaltyInfo(user2.address, 100)
        ).to.be.revertedWith(error);
    });

    it("agent should be ownable", async function () {
        const error = "Ownable: caller is not the owner";
        await expect(
            agent.connect(user1).cashout([1, 2])
        ).to.be.revertedWith(error);
    });

    it("nft should be ERC2981", async function () {
        let [recipient, bps] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(royaltyRecipient.address);
        expect(bps).to.equal(1);

        // test set royalty info
        nft.connect(admin).setTokenRoyaltyInfo(admin.address, 1000);
        [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(admin.address);
        expect(value).to.equal(10);
    });

    it("nft mint and liquidize", async function() {
        expect(await nft.uri(1)).to.equal("some_url");

        let ids1 = await createPool(
            0, "pool0", 10, 130, 100, 3000, user1.address
        );
        checkBalances(Array(ids1.length).fill(agent.address), ids1);
        let ids2 = await createPool(
            1, "pool1", 40, 160, 1000, 2000, user2.address
        );
        checkBalances(Array(ids2.length).fill(agent.address), ids2);
    });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");
const ERC1155 = require("./ERC1155.js");

describe("DeMine", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var costTokens;
    var rewardToken;
    var nft;
    var agent;

    // state simulator
    var simulator;

    var checkBalances = async function(users, ids) {
        let balances = await nft.balanceOfBatch(users, ids);
        let expectedBalances = simulator.balanceOfBatch(users, ids);
        expect(balances.length).to.equal(expectedBalances.length);
        for (var i = 0; i < balances.length; i++) {
            expect(balances[i].eq(expectedBalances[i])).to.be.true;
        }
    };

    var createPool = async function(
        pool, info, startCycle, numCycles, supplies, costPerToken, issuer
    ){
        let ids = utils.ids(pool, startCycle, numCycles);
        simulator.mintBatch(agent.address, ids, supplies);
        await expect(
            nft.connect(signers.admin).newPool(
                info, startCycle, numCycles, supplies, costPerToken, issuer
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            signers.admin.address,
            '0x0000000000000000000000000000000000000000',
            agent.address,
            ids,
            supplies
        ).to.emit(nft, "NewPool").withArgs(
            pool, issuer, costPerToken, info
        );
        checkBalances(Array(ids.length).fill(agent.address), ids);
    };

    let reward = async function(cycle, supply, totalReward) {
        let rewarder = signers.rewarder;
        let rewarderBalance = await rewardToken.balanceOf(rewarder.address);
        let nftBalance = await rewardToken.balanceOf(nft.address);

        // mint new reward tokens for rewarder
        await rewardToken.connect(
            signers.admin
        ).mint(rewarder.address, totalReward);
        expect(
            await rewardToken.balanceOf(rewarder.address)
        ).to.equal(rewarderBalance.add(totalReward));
        await rewardToken.connect(
            rewarder
        ).increaseAllowance(nft.address, totalReward);

        // reward tokens to nft contract from rewarder
        let rewardPerToken = 0;
        if (supply > 0) {
            rewardPerToken = Math.floor(totalReward / supply);
        }
        await expect(
            nft.connect(signers.admin).reward(rewarder.address, totalReward)
        ).to.emit(nft, "Reward").withArgs(
            cycle,
            rewarder.address,
            rewardPerToken,
            supply
        );

        // check reward token balance of rewarder and nft contract
        expect(
            await rewardToken.balanceOf(rewarder.address)
        ).to.equal(rewarderBalance.add(totalReward - rewardPerToken * supply));
        expect(
            await rewardToken.balanceOf(nft.address)
        ).to.equal(nftBalance.add(rewardPerToken * supply));
    };

    before(async function() {
        [
            user1,
            user2,
            user3,
            admin,
            costRecipient1,
            costRecipient2,
            costRecipient3,
            rewarder,
            rewardRecipient,
            royaltyRecipient
        ] = await ethers.getSigners();
        signers = {
            admin: admin,
            rewarder: rewarder,
            royaltyRecipient: royaltyRecipient,
            rewardRecipient: rewardRecipient,
            costRecipients: [
                costRecipient1,
                costRecipient2,
                costRecipient3
            ],
            users: [user1, user2, user3]
        };
    });

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
        simulator = new ERC1155();
    });

    it("nft: should be ERC2981", async function () {
        // set with non-admin
        await expect(
            nft.connect(
                signers.users[0]
            ).setTokenRoyaltyInfo(signers.users[1].address, 100)
        ).to.be.revertedWith(OwnableError);

        // before set
        let [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(royaltyRecipient.address);
        expect(value).to.equal(1);

        // set royalty info
        nft.connect(
            signers.admin
        ).setTokenRoyaltyInfo(signers.admin.address, 1000);

        // after set
        [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(signers.admin.address);
        expect(value).to.equal(10);
    });

    it("nft: create new pool test", async function () {
        const admin = signers.admin;
        const [user1, user2, _] = signers.users;

        let supplies = Array(120).fill(1000);
        // create new pool with non owner, should revert
        await expect(
            nft.connect(user1).newPool(
                "pool0", 10, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith(OwnableError);

        // create new pool with wrong supplies, should revert
        await expect(
            nft.connect(admin).newPool(
                "pool0", 10, 120, supplies.concat([1000]), 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: supply array length mismatch");

        // reward 9 cycle with 0 supply
        for (let i = 1; i < 10; i++) {
            await reward(i, 0, 0);
        }

        // create new pool with invalid start cycle
        await expect(
            nft.connect(admin).newPool(
                "pool0", 9, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");
        // create new pool with invalid start cycle
        await expect(
            nft.connect(admin).newPool(
                "pool0", 12, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");
        // create new pool successfully
        let ids = await createPool(
            1,
            "pool0",
            13,
            120,
            Array(120).fill(100),
            3000,
            user1.address
        );
    });

    it("nft: reward test", async function() {
        const admin = signers.admin;
        const [user1, user2, _] = signers.users;

        let startCycle = 10;
        // create new pool successfully
        await createPool(
            1,
            "pool0",
            startCycle,
            120,
            Array(120).fill(100),
            3000,
            user1.address
        );

        // reward with non-owner, should revert
        await expect(
            nft.connect(user1).reward(rewarder.address, 1000)
        ).to.be.revertedWith(OwnableError);

        // reward cycle with 0 supply
        for (let i = 1; i < startCycle; i++) {
            await reward(i, 0, 0);
        }

        console.log(
            await nft.connect(admin).reward(rewarder.address, 1000)
        );

        // reward with total reward divisiable by supply
        for (let i = startCycle; i < 20; i++) {
            await reward(i, 100, 1000);
        }
        // reward with total reward not divisiable by supply
        for (let i = 20; i < 40; i++) {
            await reward(i, 100, 910);
        }
    });

    it("nft: ERC1155", async function () {
        expect(await nft.uri(1)).to.equal("demine_nft");
    });

    it("agent should be ownable", async function () {
        const error = "Ownable: caller is not the owner";
        const [user1, _] = signers.users;
        await expect(
            agent.connect(user1).cashout([1, 2])
        ).to.be.revertedWith(error);
    });
});

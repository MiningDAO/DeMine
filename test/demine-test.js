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


    var createPool = async function(
        pool, info, startCycle, numCycles, supplies, costPerToken, issuer
    ){
        let ids = utils.ids(pool, startCycle, numCycles);
        let users = Array(ids.length).fill(agent.address);
        let before = await nft.balanceOfBatch(users, ids);
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
        let after = await nft.balanceOfBatch(users, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(after[i].sub(before[i]).eq(supplies[i])).to.be.true;
        }
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

    let setupNFT = async function () {
        const [user1, _] = signers.users;
        // create pools
        for (let i = 1; i <= 3; i++) {
            await nft.connect(signers.admin).newPool(
                "pool",
                10 * i,
                120,
                Array(120).fill(100 * i),
                1000 * i,
                user1.address
            )
        }

        // reward cycle 1-9, 0 per nft
        for (let i = 1; i < 10; i++) {
            await reward(i, 0, 0);
        }
        // reward cycle 10-19, 3 per nft
        for (let i = 10; i < 20; i++) {
            await reward(i, 100, 300);
        }
        // reward cycle 20-29, 2 per nft
        for (let i = 20; i < 30; i++) {
            await reward(i, 300, 600);
        }
        // reward cycle 20-29, 2 per nft
        for (let i = 30; i < 40; i++) {
            await reward(i, 600, 600);
        }

        //tokens to redeem
        let ids = [];
        let amounts = [];
        for (let i = 10; i < 40; i++) {
            if (i < 20) {
                ids.push(utils.id(1, i));
                amounts.push(10);
            } else if (i < 30) {
                ids.push(utils.id(2, i));
                amounts.push(20);
            } else if (i < 40) {
                ids.push(utils.id(3, i));
                amounts.push(30);
            }
        }

        // get cost tokens to redeem
        await costTokens[0].connect(
            signers.admin
        ).mint(user1.address, 10000000);
        await costTokens[0].connect(user1).approve(agent.address, 10000000);
        await agent.connect(user1).redeem(costTokens[0].address, ids, amounts);
        return { ids, amounts };
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
                "pool1", 10, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith(OwnableError);

        // create new pool with wrong supplies, should revert
        await expect(
            nft.connect(admin).newPool(
                "pool1", 10, 120, supplies.concat([1000]), 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: supply array length mismatch");

        // reward 9 cycle with 0 supply
        for (let i = 1; i < 10; i++) {
            await reward(i, 0, 0);
        }

        // create new pool with invalid start cycle
        await expect(
            nft.connect(admin).newPool(
                "pool1", 9, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");
        // create new pool with invalid start cycle
        await expect(
            nft.connect(admin).newPool(
                "pool1", 12, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");
        // create new pool successfully
        let ids = await createPool(
            1,
            "pool1",
            13,
            120,
            Array(120).fill(100),
            3000,
            user1.address
        );
    });

    it("nft: reward test", async function() {
        const admin = signers.admin;
        const rewarder = signers.rewarder;
        const [user1, _] = signers.users;

        let startCycle = 10;
        // create new pool successfully
        await nft.connect(signers.admin).newPool(
            "pool1", startCycle, 120, Array(120).fill(100), 3000, user1.address
        )

        // reward cycle with 0 supply
        for (let i = 1; i < startCycle; i++) {
            await reward(i, 0, 0);
        }

        // reward with non-owner, should revert
        await expect(
            nft.connect(user1).reward(rewarder.address, 1000)
        ).to.be.revertedWith(OwnableError);

        // reward with insufficient allowance
        await rewardToken.connect(admin).mint(rewarder.address, 1000);
        await expect(
            nft.connect(admin).reward(rewarder.address, 1000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

        // reward with insufficient balances
        await rewardToken.connect(rewarder).approve(nft.address, 10000);
        await expect(
            nft.connect(admin).reward(rewarder.address, 10000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        // reset rewardToken
        await rewardToken.connect(admin).burn(rewarder.address, 1000);
        await rewardToken.connect(
            rewarder
        ).decreaseAllowance(nft.address, 10000);

        // reward with total reward divisiable by supply
        for (let i = startCycle; i < 20; i++) {
            await reward(i, 100, 1000);
        }
        // reward with total reward not divisiable by supply
        for (let i = 20; i < 40; i++) {
            await reward(i, 100, 910);
        }
    });

    it("nft: cashout test", async function () {
        const [user1, user2, _] = signers.users;
        let { ids, amounts} = await setupNFT();
        // cashout with insufficient balance, should fail
        await expect(
            nft.connect(user2).cashout(
                user2.address,
                user1.address,
                ids,
                amounts
            )
        ).to.be.revertedWith("ERC1155: burn amount exceeds balance");

        // cashout with ids and amounts array mismatch, should fail
        await expect(
            nft.connect(user1).cashout(
                user1.address,
                user2.address,
                ids.concat([utils.id(3, 41)]),
                amounts
            )
        ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");

        // cashout with insufficient allowance, should fail
        await expect(
            nft.connect(user2).cashout(
                user1.address,
                user2.address,
                ids,
                amounts
            )
        ).to.be.revertedWith(
            "ERC1155: transfer caller is not owner nor approved"
        );

        // cashout with unrewarded cycle, should fail
        let unrewarded = utils.id(3, 41);
        await agent.connect(user1).redeem(
            costTokens[0].address,
            [unrewarded],
            [30]
        );
        await expect(
            nft.connect(user1).cashout(
                user1.address,
                user2.address,
                ids.concat([unrewarded]),
                amounts.concat([30])
            )
        ).to.be.revertedWith("DeMineNFT: unrewarded cycle");

        // redeem and cashout properly
        let users = Array(ids.length).fill(user1.address);
        await utils.checkBalances(users, ids, amounts);
        let nftBefore = await rewardToken.balanceOf(nft.address);
        let user2Before = await rewardToken.balanceOf(user2.address);
        await nft.connect(user1).cashout(
            user1.address,
            user2.address,
            ids,
            amounts
        );
        await utils.checkBalances(users, ids, Array(ids.length).fill(0));
        let nftAfter = await rewardToken.balanceOf(nft.address);
        let user2After = await rewardToken.balanceOf(user2.address);
        let delta = 10 * 3 * 10 + 20 * 2 * 10 + 30 * 1 * 10;
        expect(user2After.sub(user2Before).eq(delta)).to.be.true;
        expect(nftBefore.sub(nftAfter).eq(delta)).to.be.true;

        // redeem more and cashout with approved user
        await agent.connect(user1).redeem(costTokens[0].address, ids, amounts);
        expect(
            await nft.isApprovedForAll(user1.address, user2.address)
        ).to.be.false;
        await nft.connect(user1).setApprovalForAll(user2.address, true);
        expect(
            await nft.isApprovedForAll(user1.address, user2.address)
        ).to.be.true;

        await utils.checkBalances(users, ids, amounts);
        nftBefore = await rewardToken.balanceOf(nft.address);
        user2Before = await rewardToken.balanceOf(user2.address);
        await nft.connect(user2).cashout(
            user1.address,
            user2.address,
            ids,
            amounts
        );
        await utils.checkBalances(users, ids, Array(ids.length).fill(0));
        nftAfter = await rewardToken.balanceOf(nft.address);
        user2After = await rewardToken.balanceOf(user2.address);
        delta = 10 * 3 * 10 + 20 * 2 * 10 + 30 * 1 * 10;
        expect(user2After.sub(user2Before).eq(delta)).to.be.true;
        expect(nftBefore.sub(nftAfter).eq(delta)).to.be.true;
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

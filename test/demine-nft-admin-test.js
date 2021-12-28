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
    var nft;
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
        nft = NFT.attach(address3);

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
        await rewardToken.connect(owner).mint(owner.address, 1000000000);
        await costToken.connect(owner).mint(user1.address, 10000000);
        await costToken.connect(owner).mint(user2.address, 10000000);
    });

    it("should get reward cost token address", async function () {
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
            admin.connect(user1).reward(1)
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(
                user1
            ).rewardWithAdjustment(
                1, [1, 2], [100, 100]
            )
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).settlePrep()
        ).to.be.revertedWith(error);

        await expect(
            admin.connect(user1).settle(1000)
        ).to.be.revertedWith(error);
    });

    it("full lifecycle", async function () {
        let mint = async function(
            pool, cost, startCycle, numCycles, supplyPerCycle, user
        ) {
            let tokenIds = [];
            let supplies = [];
            for (let i = startCycle; i < startCycle + numCycles; i++) {
               tokenIds.push(ethers.BigNumber.from(2).pow(128).mul(pool).add(i));
               supplies.push(supplyPerCycle);
            }
            await expect(
                admin.connect(owner).newPool(
                    "hash",
                    cost,
                    startCycle,
                    numCycles,
                    supplyPerCycle,
                    user.address
                )
            ).to.emit(admin, "NewPool").withArgs(
                pool, "hash", cost
            ).to.emit(nft, "TransferBatch").withArgs(
                admin.address,
                '0x0000000000000000000000000000000000000000',
                user.address,
                tokenIds,
                supplies
            );
        };

        let reward = async function(
            startCycle, endCycle, totalReward, rewardPerToken, pools, adjustments
        ) {
            await rewardToken.connect(owner).transfer(admin.address, totalReward);
            for (let i = startCycle; i < endCycle; i++) {
                if (i % 10 == 0) {
                    await expect(
                        admin.connect(owner).rewardWithAdjustment(
                            rewardPerToken, pools, adjustments
                        )
                    ).to.emit(admin, "RewardWithAdjustment").withArgs(
                        // 1% adjustment for pool 0
                        i, rewardPerToken, pools, adjustments
                    );
                } else {
                    await expect(
                        admin.connect(owner).reward(rewardPerToken)
                    ).to.emit(admin, "Reward").withArgs(i, rewardPerToken);
                }

                let [reward, cost, adjustment] = await admin.NFTStats(i);
                expect(reward.eq(rewardPerToken)).to.be.true;
                expect(cost.eq(3000)).to.be.true;
                expect(adjustment.eq(i % 10 == 0 ? 1000000 : 0)).to.be.true;
            }
        };

        let checkStats = async function(
            pool, startCycle, endCycle, amount, expectedReward, expectedCost
        ) {
            let ids = [];
            let amounts = [];
            for (let i = startCycle; i < endCycle; i++) {
               ids.push(ethers.BigNumber.from(2).pow(128).mul(pool).add(i));
               amounts.push(amount);
            }

            let [reward, cost] = await admin.aggregate(ids, amounts);
            expect(reward.eq(expectedReward)).to.be.true;
            expect(cost.eq(expectedCost)).to.be.true;
        };

        let settle = async function(rewardTokenPrice) {
            await expect(
                admin.connect(owner).settle(rewardTokenPrice)
            ).to.be.revertedWith("Pausable: not paused");

            await expect(
                admin.connect(owner).settlePrep()
            ).emit(nft, "Paused").withArgs(admin.address);
            expect(await nft.paused()).to.be.true;
            let allowance = await rewardToken.allowance(
                admin.address, owner.address
            );
            expect(
                allowance.eq(ethers.BigNumber.from(2).pow(256).sub(1))
            ).to.be.true;

            await expect(
                admin.connect(owner).settlePrep()
            ).to.be.revertedWith("Pausable: paused");

            await expect(
                admin.connect(owner).settle(rewardTokenPrice)
            ).emit(nft, "Unpaused").withArgs(admin.address);
            expect(await nft.paused()).to.be.false;
            allowance = await rewardToken.allowance(
                admin.address, owner.address
            );
            expect(allowance.eq(0)).to.be.true
        };

        await mint(0, 3000, 10, 540, 10000, user1);
        await mint(1, 2000, 40, 180, 100000, user2);

        await expect(
            admin.connect(owner).march(10)
        ).to.emit(admin, "March").withArgs(0, 10);

        await reward(10, 20, 18981000, 200, [0], [1000000]);
        await reward(20, 30, 18981000, 190, [0], [1000000]);
        await reward(30, 40, 18981000, 180, [0], [1000000]);

        await checkStats(0, 10, 40, 1000, 5694300, 89910000);
        await settle(5000000);

//        await reward(40, 70, 170, [0, 1], [1000000, 100000]);
//        await reward(70, 100, 180, [0, 1], [1000000, 100000]);
    });
});

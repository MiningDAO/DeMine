const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");

describe("DeMine Agent", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var contracts;

    let compareArray = async function(a, b) {
        expect(a.length).to.equal(b.length);
        for (let i = 0; i < a.length; i++) {
            expect(a[i]).to.equal(b[i]);
        }
    };

    let checkListingInfo = async function(
        to, ids, expectedPrices, expectedAmounts
    ) {
        let [prices, amounts] = await agent.listingInfo(to, ids);
        compareArray(prices, expectedPrices);
        compareArray(amounts, expectedAmounts);
    }

    let checkTokenInfo = async function(id, expected) {
        let tokenInfo = await agent.tokenInfo(id);
        compareArray(tokenInfo, expected);
    };

    let checkBalances = async function(user, ids, expected) {
        let users = Array(ids.length).fill(user.address);
        let balances = await nft.balanceOfBatch(users, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(balances[i]).to.equal(expected[i]);
        }
    };

    before(async function() {
        signers = await utils.signers();
    });

    beforeEach(async function() {
        contracts = await utils.setupDeMine(signers);
    });

    it("ERC1155 Receiver", async function () {
        const { admin, users: [user1, user2, _] } = signers;
        const { nft, payments, agent } = contracts;
        let numCycles = 120;
        let ids = utils.ids(1, 10, numCycles);
        let supplies = Array(numCycles).fill(100);

        // create pool and receive tokens
        await expect(
            nft.connect(admin).newPool(
                "pool", 10, 120, supplies, 1000, user1.address
            )
        ).to.emit(agent, "PoolSet").withArgs(
            1, user1.address, 1000
        );

        checkBalances(agent, ids, supplies);

        // redeem all to user
        await utils.airdrop(
            payments[0], admin, user1, agent, 100000000
        );
        await agent.connect(user1).redeem(
            payments[0].address, ids, supplies
        );
        checkBalances(agent, ids, Array(numCycles).fill(0));
        checkBalances(user1, ids, supplies);

        // should not receive tokens from custom user
        await expect(
            nft.connect(user1).safeTransferFrom(
                user1.address, agent.address, ids[0], supplies[0], []
            )
        ).to.be.revertedWith("DeMineAgent: only newly minted token allowed");
        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user1.address, agent.address, ids, supplies, []
            )
        ).to.be.revertedWith("DeMineAgent: only newly minted token allowed");

        // setup another ERC1155
        const ERC1155Test = await ethers.getContractFactory("ERC1155Test");
        erc1155Test = await ERC1155Test.connect(admin).deploy();
        await erc1155Test.deployed();

        await expect(
            erc1155Test.connect(admin).safeTransferFrom(
                admin.address, agent.address, 0, 10, []
            )
        ).to.be.revertedWith("DeMineAgent: only nft contract allowed");

        await expect(
            erc1155Test.connect(admin).safeBatchTransferFrom(
                admin.address, agent.address, [0, 1], [10, 10], []
            )
        ).to.be.revertedWith("DeMineAgent: only nft contract allowed");
    });

    it("transfer pool", async function () {
        const [user1, user2, _] = signers.users;

        // pool 1 should be set
        let { ids, amounts } = await utils.mintAndRedeem(
            contracts, signers.admin, user1
        );
        let [owner, costPerToken] = await agent.poolInfo(1);
        expect(owner).to.equal(user1.address);
        expect(costPerToken).to.equal(1000);

        // transfer pool with nor owner
        await expect(
            agent.connect(user2).transferPool(1, user2.address)
        ).to.be.revertedWith(
            "DeMineAgent: only pool owner is allowed"
        );

        // transfer pool with owner
        await expect(
            agent.connect(user1).transferPool(1, user2.address)
        ).to.emit(agent, "PoolTransfer").withArgs(
            1, user1.address, user2.address
        );
    });

    it("set payment", async function () {
        let { admin, users: [user1, _] } = signers;
        let { payments: [p1, p2, p3] } = contracts;
        // get payment
        expect(await agent.isPaymentSupported(p1.address)).to.be.true;
        expect(await agent.isPaymentSupported(p2.address)).to.be.true;
        expect(await agent.isPaymentSupported(p3.address)).to.be.true;

        // set with non-owner, should fail
        await expect(
            agent.connect(user1).setPayment(p1.address, false)
        ).to.be.revertedWith(OwnableError);

        // set payment
        await expect(
            agent.connect(admin).setPayment(p1.address, false)
        ).to.emit(agent, "PaymentSet").withArgs(
            p1.address, false
        );
        expect(await agent.isPaymentSupported(p1.address)).to.be.false;
    });

    it("set reward token recipient", async function () {
        let { custodian } = signers;
        // set with non-owner, should fail
        await expect(
            agent.connect(user1).setCustodian(user1.address)
        ).to.be.revertedWith(OwnableError);

        // set with non-owner, should fail
        await expect(
            agent.connect(admin).setCustodian(user1.address)
        ).to.emit(agent, "CustodianSet").withArgs(
            custodian.address, user1.address
        );
    });

    it("redeem", async function () {
        const { admin, custodian, users: [user1, _] } = signers;
        const { nft, agent, payments: [p1, p2, p3] } = contracts;
        let numCycles = 120;
        let supplies = Array(numCycles).fill(100);
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user1.address
        ); // pool 1
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user1.address
        ); // pool 2
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user2.address
        ); // pool 3
        await utils.airdrop(p1, admin, user1, agent, 100000000);
        await utils.airdrop(p2, admin, user1, agent, 100000000);
        await agent.connect(admin).setPayment(p2.address, false);

        let ids = [utils.id(1, 10), utils.id(2, 10)];
        await expect(
            agent.connect(user1).redeem(p1.address, ids, [100, 100, 100])
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user1).redeem(p2.address, ids, [100, 100])
        ).to.be.revertedWith("DeMineAgent: payment method not supported");

        await expect(
            agent.connect(user1).redeem(p1.address, ids, [100, 1000])
        ).to.be.revertedWith("DeMineAgent: insufficient balance to liquidize");

        await expect(
            agent.connect(user1).redeem(
                p1.address,
                ids.concat([utils.id(3, 10)]),
                [100, 100, 100]
            )
        ).to.be.revertedWith("DeMineAgent: only token owner allowed");

        await expect(
            agent.connect(user1).redeem(p3.address, ids, [50, 50])
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        await checkBalances(agent, ids, [100, 100]);
        await checkBalances(user1, ids, [0, 0]);
        let b1 = await p1.balanceOf(user1.address);
        let bc = await p1.balanceOf(custodian.address);
        for (let i = 0; i < ids; i++) {
            await checkTokenInfo(ids[i], [false, 0, 100, 0]);
        }

        let totalCost = 1000 * 50 * 2;
        await expect(
            agent.connect(user1).redeem(p1.address, ids, [50, 50])
        ).to.emit(agent, "Redeem").withArgs(
            user1.address, totalCost, ids, [50, 50]
        );

        await checkBalances(agent, ids, [50, 50]);
        await checkBalances(user1, ids, [50, 50]);
        let b12 = await p1.balanceOf(user1.address);
        let bc2 = await p1.balanceOf(custodian.address);
        expect(b1.sub(b12)).to.equal(totalCost);
        expect(bc2.sub(bc)).to.equal(totalCost);

        for (let i = 0; i < ids; i++) {
            await checkTokenInfo(ids[i], [false, 50, 50, 0]);
        }
    });

    it("list and unlist", async function () {
        // setup
        const { admin, custodian, users: [user1, _] } = signers;
        const { nft, agent, payments: [p1, p2, p3] } = contracts;
        let numCycles = 120;
        let supplies = Array(numCycles).fill(100);
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user1.address
        ); // pool 1
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user1.address
        ); // pool 2
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user2.address
        ); // pool 3
        await utils.airdrop(p1, admin, user1, agent, 100000000);
        await utils.airdrop(p2, admin, user1, agent, 100000000);
        await agent.connect(admin).setPayment(p2.address, false);

        let ids = [utils.id(1, 10), utils.id(2, 20)];
        let amounts = [50, 50];
        let prices = [2000, 2000];
        await expect(
            agent.connect(user1).list(user2.address, ids, [2000], [100])
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user1).list(user1.address, ids, prices, amounts)
        ).to.be.revertedWith("DeMineAgent: cannot set owner as recipient");

        await expect(
            agent.connect(user1).list(
                user2.address,
                ids.concat([utils.id(3, 10)]),
                [2000, 2000, 2000],
                [50, 50, 50]
            )
        ).to.be.revertedWith("DeMineAgent: only token owner allowed");

        await expect(
            agent.connect(user1).list(user2.address, ids, [500, 500], amounts)
        ).to.be.revertedWith("DeMineAgent: price too low to cover cost");

        await expect(
            agent.connect(user1).list(user2.address, ids, prices, [200, 100])
        ).to.be.revertedWith("DeMineAgent: insufficient balance to sale");

        await checkTokenInfo(ids[0], [false, 0, 100, 0]);
        await checkTokenInfo(ids[1], [false, 0, 100, 0]);
        await expect(
            agent.connect(user1).list(user2.address, ids, prices, amounts)
        ).to.emit(agent, "List").withArgs(
            user1.address,
            user2.address,
            ids,
            amounts,
            prices
        );
        await checkListingInfo(user2.address, ids, prices, amounts);
        await checkTokenInfo(ids[0], [false, 0, 50, 50]);
        await checkTokenInfo(ids[1], [false, 0, 50, 50]);

        await expect(
            agent.connect(user1).list(user2.address, ids, prices, [110, 100])
        ).to.be.revertedWith("DeMineAgent: insufficient balance to sale");

        // reset list, should success
        await expect(
            agent.connect(user1).list(user2.address, ids, prices, [40, 30])
        ).to.emit(agent, "List").withArgs(
            user1.address,
            user2.address,
            ids,
            [40, 30],
            prices
        );
        await checkListingInfo(user2.address, ids, prices, [40, 30]);
        await checkTokenInfo(ids[0], [false, 0, 60, 40]);
        await checkTokenInfo(ids[1], [false, 0, 70, 30]);

        // list more to address(0) with insufficient supply, should fail
        let address0 = ethers.utils.getAddress(
            "0x0000000000000000000000000000000000000000"
        );
        await expect(
            agent.connect(user1).list(address0, ids, prices, [70, 50])
        ).to.be.revertedWith("DeMineAgent: insufficient balance to sale");

        // list more to address(0) should success
        await expect(
            agent.connect(user1).list(address0, ids, prices, [30, 40])
        ).to.emit(agent, "List").withArgs(
            user1.address,
            address0,
            ids,
            [30, 40],
            prices
        );
        await checkListingInfo(address0, ids, prices, [30, 40]);
        await checkTokenInfo(ids[0], [false, 0, 30, 70]);
        await checkTokenInfo(ids[1], [false, 0, 30, 70]);

        // list more to address(0) should success
        await expect(
            agent.connect(user1).list(address0, ids, prices, [40, 30])
        ).to.emit(agent, "List").withArgs(
            user1.address,
            address0,
            ids,
            [40, 30],
            prices
        );
        await checkListingInfo(address0, ids, prices, [40, 30]);
        await checkTokenInfo(ids[0], [false, 0, 20, 80]);
        await checkTokenInfo(ids[1], [false, 0, 40, 60]);

        // unlist with non-owner, should fail
        await expect(
            agent.connect(user1).unlist(
                user2.address,
                ids.concat([utils.id(3, 10)])
            )
        ).to.be.revertedWith("DeMineAgent: only token owner allowed");

        // unlist user2 success
        await expect(
            agent.connect(user1).unlist(user2.address, ids)
        ).to.emit(agent, "Unlist").withArgs(
            user1.address, user2.address, ids
        );
        await checkListingInfo(user2.address, ids, prices, [0, 0]);
        await checkTokenInfo(ids[0], [false, 0, 60, 40]);
        await checkTokenInfo(ids[1], [false, 0, 70, 30]);

        // unlist address0 success
        await expect(
            agent.connect(user1).unlist(address0, ids)
        ).to.emit(agent, "Unlist").withArgs(
            user1.address, address0, ids
        );
        checkListingInfo(address0, ids, prices, [0, 0]);
        await checkTokenInfo(ids[0], [false, 0, 100, 0]);
        await checkTokenInfo(ids[1], [false, 0, 100, 0]);

        // reward and cashout
        for (let i = 1; i < 10; i++) {
            await utils.reward(contracts, signers, i, 0, 0);
        }
        for (let i = 10; i < 20; i++) {
            await utils.reward(contracts, signers, i, 300, 900);
        }
        await agent.connect(admin).cashout([ids[0]]);

        // should fail to list cashed out tokens
        await expect(
            agent.connect(user1).list(user2.address, ids, prices, amounts)
        ).to.be.revertedWith("DeMineAgent: already cashed out");

        await expect(
            agent.connect(user1).unlist(user2.address, ids)
        ).to.be.revertedWith("DeMineAgent: already cashed out");
    });
});

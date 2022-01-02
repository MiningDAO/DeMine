const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");

describe("DeMine Agent", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var contracts;

    let checkBalances = async function(user, ids, expected)  {
        let users = Array(ids.length).fill(user.address);
        let balances = await nft.balanceOfBatch(users, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(balances[i]).to.equal(expected[i]);
        }
    }

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

        // test start
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
            let tokeninfo = await agent.tokeninfo(ids[i]);
            expect(tokeninfo).to.deep.equal([false, 0, 100, 0]);
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
            let tokeninfo = await agent.tokeninfo(ids[i]);
            expect(tokeninfo).to.deep.equal([false, 50, 50, 0]);
        }
    });

    it("list and unlist", async function () {
    });
});

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

    it("ERC1155 Receiver", async function () {
        const { admin, users: [user1, user2, _] } = signers;
        const { nft, costTokens, agent } = contracts;
        let numCycles = 120;
        let ids = utils.ids(1, 10, numCycles);
        let supplies = Array(numCycles).fill(100);
        // create pool and receive tokens
        await nft.connect(admin).newPool(
            "pool", 10, 120, supplies, 1000, user1.address
        );
        let checkBalances = async function(user, ids, expected)  {
            let users = Array(120).fill(user.address);
            let balances = await nft.balanceOfBatch(users, ids);
            for (var i = 0; i < ids.length; i++) {
                expect(balances[i]).to.equal(expected[i]);
            }
        }
        checkBalances(agent, ids, supplies);

        // redeem all to user
        await utils.airdrop(
            costTokens[0], admin, user1, agent, 100000000
        );
        await agent.connect(user1).redeem(
            costTokens[0].address, ids, supplies
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
});

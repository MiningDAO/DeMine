const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-utils.js");
const ERC1155 = require("./ERC1155.js");

describe("DeMine", function () {
    var signers;
    var rewardToken;
    var costTokens;
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
            user1,
            user2,
            user3,
            admin,
            costRecipient1,
            costRecipient2,
            costRecipient3,
            rewardRecipient,
            royaltyRecipient
        ] = await ethers.getSigners();
        signers = {
            admin: admin,
            royaltyRecipient: royaltyRecipient,
            rewardRecipient: rewardRecipient,
            costRecipients: [
                costRecipient1,
                costRecipient2,
                costRecipient3
            ],
            users: [user1, user2, user3]
        };
        rewardToken = utils.setupRewardToken(admin);
        costTokens = utils.setupPaymentTokens(admin, 3);
    });

    beforeEach(async function() {
        let { nft, agent } = await utils.setupDeMine(signers);
    });

    it("nft should be ownable", async function () {
        const error = "Ownable: caller is not the owner";
        const [user1, _, _] = signers.users;
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
        // before
        let [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(royaltyRecipient.address);
        expect(value).to.equal(1);

        // set royalty info
        nft.connect(admin).setTokenRoyaltyInfo(admin.address, 1000);

        // after
        [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(admin.address);
        expect(value).to.equal(10);
    });

    it("nft mint and liquidize", async function() {
        expect(await nft.uri(1)).to.equal("some_url");
        const [user1, _, _] = signers.users;
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

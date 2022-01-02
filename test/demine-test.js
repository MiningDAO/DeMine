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
        pool, info, startCycle, numCycles, supplies, costPerToken, issuer
    ){
        let ids = utils.ids(pool, startCycle, numCycles);
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
        rewardToken = await utils.setupRewardToken(admin);
        costTokens = await utils.setupPaymentTokens(admin, 3);
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
        ).to.be.revertedWith(error);

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

    it("nft: create new pool", async function () {
        const [user1, _] = signers.users;
        let ids = utils.ids(0, 10, 120);
        let supplies = Array(120).fill(1000);
        await expect(
            nft.connect(user1).newPool(
                "hash", 10, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith(OwnableError);

        await expect(
            nft.connect(user1).newPool(
                "hash", 10, 130, supplies.concat([1000]), 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: supply array length mismatch");

        let ids1 = await createPool(
            1, "pool0", 10, 130, 100, 3000, user1.address
        );
        checkBalances(Array(ids1.length).fill(agent.address), ids1);
        let ids2 = await createPool(
            2, "pool1", 40, 160, 1000, 2000, user2.address
        );
        checkBalances(Array(ids2.length).fill(agent.address), ids2);

        // reward
        await expect(
            nft.connect(user1).reward(rewarder.address, 1000)
        ).to.be.revertedWith(error);

        await expect(
            nft.connect(user1).reward(rewarder.address, 1000)
        ).to.be.revertedWith(error);
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

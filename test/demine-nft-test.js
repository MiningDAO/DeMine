const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");

describe("DeMine NFT", function () {
    const OwnableError = "Ownable: caller is not the owner";
    var signers;
    var contracts;

    let mintRedeemAndReward = async function(...args) {
        let result = await utils.mintAndRedeem(...args);

        // reward cycle 1-40, 0 per nft
        for (let i = 1; i < 10; i++) {
            await utils.rewardNext(contracts, signers, i, 0, 0);
        }
        for (let i = 10; i < 20; i++) {
            await utils.rewardNext(contracts, signers, i, 100, 300);
        }
        for (let i = 20; i < 30; i++) {
            await utils.rewardNext(contracts, signers, i, 300, 600);
        }
        for (let i = 30; i < 40; i++) {
            await utils.rewardNext(contracts, signers, i, 600, 600);
        }
        return result;
    }

    before(async function() {
        signers = await utils.signers();
    });

    beforeEach(async function() {
        contracts = await utils.setupDeMine(signers);
    });

    it("Pausable", async function () {
        let { nft } = contracts;
        expect(await nft.paused()).to.be.false;

        // setup
        let { admin, users: [user1, user2, _] } = signers;
        let { ids, amounts } = await mintRedeemAndReward(
            contracts, admin, user1
        );

        await expect(
            nft.connect(user1).pause()
        ).to.be.revertedWith(OwnableError);

        await expect(
            nft.connect(admin).pause()
        ).to.emit(nft, "Paused").withArgs(admin.address);
        expect(await nft.paused()).to.be.true;

        await expect(
            nft.connect(admin).newPool(
                60,
                120,
                Array(120).fill(100),
                1000,
                user1.address
            )
        ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");

        await expect(
            nft.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                ids[0],
                amounts[0],
                []
            )
        ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");

        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user1.address,
                user2.address,
                ids,
                amounts,
                []
            )
        ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");

        await expect(
            nft.connect(user1).cashout(
                user1.address,
                user2.address,
                ids,
                amounts
            )
        ).to.be.revertedWith("ERC1155Pausable: token transfer while paused");

        // unpause
        await expect(
            nft.connect(user1).unpause()
        ).to.be.revertedWith(OwnableError);

        await expect(
            nft.connect(admin).unpause()
        ).to.emit(nft, "Unpaused").withArgs(admin.address);
        expect(await nft.paused()).to.be.false;

        nft.connect(admin).newPool(
            60,
            120,
            Array(120).fill(100),
            1000,
            user1.address
        )

        await expect(
            nft.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                ids[0],
                amounts[0],
                []
            )
        ).to.emit(nft, "TransferSingle").withArgs(
            user1.address,
            user1.address,
            user2.address,
            ids[0],
            amounts[0]
        );

        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user1.address,
                user2.address,
                ids.slice(1),
                amounts.slice(1),
                []
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            user1.address,
            user1.address,
            user2.address,
            ids.slice(1),
            amounts.slice(1)
        );

        let delta = 10 * 3 * 10 + 20 * 2 * 10 + 30 * 1 * 10;
        expect(
            await nft.connect(user2).cashout(
                user2.address,
                user1.address,
                ids,
                amounts
            )
        ).to.emit(nft, "Cashout").withArgs(
            user2.address, user2.address, user1.address, delta
        );
    });

    it("ERC2981", async function () {
        let { nft } = contracts;
        let admin = signers.admin;
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
        expect(
            await nft.connect(admin).setTokenRoyaltyInfo(admin.address, 1000)
        ).to.emit(nft, "TokenRoyaltySet").withArgs(admin.address, 1000);

        // after set
        [recipient, value] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(signers.admin.address);
        expect(value).to.equal(10);
    });

    it("create pool tests", async function () {
        let { nft, agent } = contracts;
        let { admin, users: [user1, user2, _] } = signers;

        let supplies = Array(120).fill(1000);
        // create new pool with non owner, should revert
        await expect(
            nft.connect(user1).newPool(
                10, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith(OwnableError);

        // create new pool with wrong supplies, should revert
        const address0 = ethers.utils.getAddress(
            "0x0000000000000000000000000000000000000000"
        );
        await expect(
            nft.connect(admin).newPool(
                10, 120, supplies.concat([1000]), 100, address0
            )
        ).to.be.revertedWith("DeMineNFT: pool owner is zero address");

        // create new pool with wrong supplies, should revert
        await expect(
            nft.connect(admin).newPool(
                10, 120, supplies.concat([1000]), 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: supply array length mismatch");

        // reward 9 cycle with 0 supply
        for (let i = 1; i < 10; i++) {
            await utils.rewardNext(contracts, signers, i, 0, 0);
        }

        // create new pool with invalid start cycle
        await expect(
            nft.connect(admin).newPool(
                12, 120, supplies, 100, user2.address
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");

        // create new pool successfully
        let ids = utils.ids(1, 13, 120);
        let users = Array(ids.length).fill(agent.address);
        let before = await nft.balanceOfBatch(users, ids);
        await expect(
            nft.connect(admin).newPool(
                13, 120, supplies, 3000, user1.address
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            admin.address,
            '0x0000000000000000000000000000000000000000',
            agent.address,
            ids,
            supplies
        );
        let after = await nft.balanceOfBatch(users, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(after[i].sub(before[i]).eq(supplies[i])).to.be.true;
        }
    });

    it("expand pool tests", async function () {
        let { nft, agent } = contracts;
        let { admin, users: [user1, _] } = signers;
        let supplies = Array(120).fill(1000);

        await expect(
            nft.connect(admin).expandPool(
                1, 10, 120, supplies
            )
        ).to.be.revertedWith("DeMineNFT: pool doesn't exsit");

        await nft.connect(admin).newPool(
            10, 120, supplies, 3000, user1.address
        );

        // reward 9 cycle with 0 supply
        for (let i = 1; i < 10; i++) {
            await utils.rewardNext(contracts, signers, i, 0, 0);
        }

        await expect(
            nft.connect(user1).expandPool(
                1, 10, 120, supplies
            )
        ).to.be.revertedWith(OwnableError);


        await expect(
            nft.connect(admin).expandPool(
                1, 12, 120, supplies
            )
        ).to.be.revertedWith("DeMineNFT: startCycle too early");

        await expect(
            nft.connect(admin).expandPool(
                1, 15, 119, supplies
            )
        ).to.be.revertedWith("DeMineNFT: supply array length mismatch");

        let ids = utils.ids(1, 15, 120);
        let users = Array(ids.length).fill(agent.address);
        let before = await nft.balanceOfBatch(users, ids);
        await expect(
            nft.connect(admin).expandPool(
                1, 15, 120, supplies
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            admin.address,
            '0x0000000000000000000000000000000000000000',
            agent.address,
            ids,
            supplies
        );
        let after = await nft.balanceOfBatch(users, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(after[i].sub(before[i]).eq(supplies[i])).to.be.true;
        }
    });

    it("reward tests", async function() {
        let { nft, rewardToken } = contracts;
        const { admin, rewarder, users: [user1, _] } = signers;

        let startCycle = 10;
        // create new pool successfully
        await nft.connect(signers.admin).newPool(
            startCycle, 120, Array(120).fill(100), 3000, user1.address
        )

        // reward cycle with 0 supply
        for (let i = 1; i < startCycle; i++) {
            await utils.rewardNext(contracts, signers, i, 0, 0);
        }

        await expect(
            await nft.connect(admin).rewardCurrent(rewarder.address, 100)
        ).to.emit(nft, "Reward").withArgs(
            startCycle - 1, rewarder.address, 0, 0
        );

        // reward with non-owner, should revert
        await expect(
            nft.connect(user1).rewardNext(rewarder.address, 1000)
        ).to.be.revertedWith(OwnableError);

        // reward with insufficient allowance
        await rewardToken.connect(admin).mint(rewarder.address, 1000);
        await expect(
            nft.connect(admin).rewardNext(rewarder.address, 1000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

        // reward with insufficient balances
        await rewardToken.connect(rewarder).approve(nft.address, 10000);
        await expect(
            nft.connect(admin).rewardNext(rewarder.address, 10000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        // reward with total reward divisiable by supply
        for (let i = startCycle; i < 20; i++) {
            await utils.rewardNext(contracts, signers, i, 100, 1000);
        }

        // reward with total reward not divisiable by supply
        for (let i = 20; i < 40; i++) {
            await utils.rewardNext(contracts, signers, i, 100, 910);
        }

        // rewardCurrent tests
        let balance = await rewardToken.balanceOf(rewarder.address);
        await rewardToken.connect(admin).burn(rewarder.address, balance);

        await expect(
            nft.connect(user1).rewardCurrent(rewarder.address, 1000)
        ).to.be.revertedWith(OwnableError);

        await rewardToken.connect(rewarder).approve(nft.address, 5000);
        await expect(
            nft.connect(admin).rewardCurrent(rewarder.address, 1000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        await rewardToken.connect(admin).mint(rewarder.address, 5000);
        await rewardToken.connect(rewarder).approve(nft.address, 2000);
        await expect(
            nft.connect(admin).rewardCurrent(rewarder.address, 5000)
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

        await expect(
            nft.connect(admin).rewardCurrent(rewarder.address, 1000)
        ).to.emit(nft, "Reward").withArgs(
            39, rewarder.address, 19, 100
        );

        await expect(
            nft.connect(admin).rewardCurrent(rewarder.address, 910)
        ).to.emit(nft, "Reward").withArgs(
            39, rewarder.address, 28, 100
        );
    });

    it("cashout test", async function () {
        let { nft, agent, rewardToken, payments } = contracts;
        let { admin, users: [user1, user2, _] } = signers;
        let { ids, amounts } = await mintRedeemAndReward(contracts, admin, user1);

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
            payments[0].address,
            3,
            [41],
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
        let delta = 10 * 3 * 10 + 20 * 2 * 10 + 30 * 1 * 10;

        await expect(
            nft.connect(user1).cashout(
                user1.address,
                user2.address,
                ids,
                amounts
            )
        ).to.emit(nft, "Cashout").withArgs(
            user1.address, user1.address, user2.address, delta
        ).to.emit(nft, "TransferBatch").withArgs(
            user1.address,
            user1.address,
            '0x0000000000000000000000000000000000000000',
            ids,
            amounts
        );

        await utils.checkBalances(users, ids, Array(ids.length).fill(0));
        let nftAfter = await rewardToken.balanceOf(nft.address);
        let user2After = await rewardToken.balanceOf(user2.address);
        expect(user2After.sub(user2Before).eq(delta)).to.be.true;
        expect(nftBefore.sub(nftAfter).eq(delta)).to.be.true;

        // redeem more and cashout with approved user
        await utils.redeem(agent, user1, payments[0], ids, amounts);
        await nft.connect(user1).setApprovalForAll(user2.address, true);
        await utils.checkBalances(users, ids, amounts);
        nftBefore = await rewardToken.balanceOf(nft.address);
        user2Before = await rewardToken.balanceOf(user2.address);

        expect(
            await nft.connect(user2).cashout(
                user1.address,
                user2.address,
                ids,
                amounts
            )
        ).to.emit(nft, "Cashout").withArgs(
            user2.address, user1.address, user2.address, delta
        ).to.emit(nft, "TransferBatch").withArgs(
            user2.address,
            user1.address,
            '0x0000000000000000000000000000000000000000',
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

    it("ERC1155 general", async function () {
        let { nft } = contracts;
        const [user1, user2, _] = signers.users;

        // test uri
        expect(await nft.uri(utils.id(1, 1))).to.equal("demine_nft");

        // test setApproval
        expect(
            await nft.isApprovedForAll(user2.address, user1.address)
        ).to.be.false;

        await expect(
            nft.connect(user2).setApprovalForAll(user1.address, true)
        ).to.emit(nft, "ApprovalForAll").withArgs(
            user2.address,
            user1.address,
            true
        );

        expect(
            await nft.isApprovedForAll(user2.address, user1.address)
        ).to.be.true;
    });

    it("ERC1155 transfer", async function () {
        let { nft } = contracts;
        const [user1, user2, _] = signers.users;
        let { ids, amounts } = await utils.mintAndRedeem(
            contracts, signers.admin, user1
        );
        let id = ids[0];
        let amount = amounts[0];

        // not enough balance, should fail
        await expect(
            nft.connect(user2).safeTransferFrom(
                user2.address,
                user1.address,
                id,
                amount,
                []
            )
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");

        // not approved, should fail
        await expect(
            nft.connect(user2).safeTransferFrom(
                user1.address,
                user2.address,
                id,
                amount,
                []
            )
        ).to.be.revertedWith(
            "ERC1155: caller is not owner nor approved"
        );

        // should success
        let before1 = await nft.balanceOf(user1.address, id);
        let before2 = await nft.balanceOf(user2.address, id);

        await expect(
            nft.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                id,
                amount,
                []
            )
        ).to.emit(nft, "TransferSingle").withArgs(
            user1.address,
            user1.address,
            user2.address,
            id,
            amount
        );

        let after1 = await nft.balanceOf(user1.address, id);
        let after2 = await nft.balanceOf(user2.address, id);
        expect(before1.sub(after1).eq(amount)).to.be.true;
        expect(after2.sub(before2).eq(amount)).to.be.true;

        // should success
        await nft.connect(user2).setApprovalForAll(user1.address, true);
        before1 = await nft.balanceOf(user1.address, id);
        before2 = await nft.balanceOf(user2.address, id);

        await expect(
            await nft.connect(user1).safeTransferFrom(
                user2.address,
                user1.address,
                id,
                amount,
                []
            )
        ).to.emit(nft, "TransferSingle").withArgs(
            user1.address,
            user2.address,
            user1.address,
            id,
            amount
        );

        after1 = await nft.balanceOf(user1.address, id);
        after2 = await nft.balanceOf(user2.address, id);
        expect(after1.sub(before1).eq(amount)).to.be.true;
        expect(before2.sub(after2).eq(amount)).to.be.true;
    });

    it("ERC1155 batch transfer", async function () {
        let { nft } = contracts;
        const [user1, user2, _] = signers.users;
        let { ids, amounts } = await utils.mintAndRedeem(
            contracts, signers.admin, user1
        );
        // not enough balance, should fail
        await expect(
            nft.connect(user2).safeBatchTransferFrom(
                user2.address,
                user1.address,
                ids,
                amounts,
                []
            )
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");

        // not approved, should fail
        await expect(
            nft.connect(user2).safeBatchTransferFrom(
                user1.address,
                user2.address,
                ids,
                amounts,
                []
            )
        ).to.be.revertedWith(
            "ERC1155: transfer caller is not owner nor approved"
        );

        // should success
        let users1 = Array(ids.length).fill(user1.address);
        let users2 = Array(ids.length).fill(user2.address);
        let before1 = await nft.balanceOfBatch(users1, ids);
        let before2 = await nft.balanceOfBatch(users2, ids);

        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user1.address,
                user2.address,
                ids,
                amounts,
                []
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            user1.address,
            user1.address,
            user2.address,
            ids,
            amounts
        );

        let after1 = await nft.balanceOfBatch(users1, ids);
        let after2 = await nft.balanceOfBatch(users2, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(before1[i].sub(after1[i]).eq(amounts[i])).to.be.true;
            expect(after2[i].sub(before2[i]).eq(amounts[i])).to.be.true;
        }

        // should success
        await nft.connect(user2).setApprovalForAll(user1.address, true);
        before1 = await nft.balanceOfBatch(users1, ids);
        before2 = await nft.balanceOfBatch(users2, ids);

        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user2.address,
                user1.address,
                ids,
                amounts,
                []
            )
        ).to.emit(nft, "TransferBatch").withArgs(
            user1.address,
            user2.address,
            user1.address,
            ids,
            amounts
        );


        after1 = await nft.balanceOfBatch(users1, ids);
        after2 = await nft.balanceOfBatch(users2, ids);
        for (var i = 0; i < ids.length; i++) {
            expect(after1[i].sub(before1[i]).eq(amounts[i])).to.be.true;
            expect(before2[i].sub(after2[i]).eq(amounts[i])).to.be.true;
        }
    });
});

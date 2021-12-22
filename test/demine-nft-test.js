const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeMineNFT", function () {
    var owner;
    var user1;
    var user2;
    var nftFactory;
    var nft;

    before(async function() {
        [user1, user2, owner] = await ethers.getSigners();
        const NFTFactory = await ethers.getContractFactory("DeMineNFTCloneFactory");
        nftFactory = await NFTFactory.deploy();
        await nftFactory.deployed();
    });

    beforeEach(async function() {
        const NFT = await ethers.getContractFactory("DeMineNFT");
        const tx = await nftFactory.create("some_url", owner.address, 100, owner.address)
        const { events } = await tx.wait();
        const { address } = events.find(Boolean);
        nft = await NFT.attach(address);
    });

    it("should be ERC2981", async function () {
        let [recipient, bps] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(owner.address);
        expect(bps).to.equal(1);

        // test set royalty info
        nft.connect(owner).setTokenRoyaltyBps(1000);
        [recipient, bps] = await nft.royaltyInfo(1, 100);
        expect(recipient).to.equal(owner.address);
        expect(bps).to.equal(10);
    });

    it("should be ownable", async function () {
        await expect(
            nft.connect(user1).mint(user1.address, [], [])
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
            nft.connect(user1).pause()
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
            nft.connect(user1).unpause()
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
            nft.connect(user1).setTokenRoyaltyBps(1000)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should be pausable", async function () {
        await expect(
            nft.connect(owner).unpause()
        ).to.be.revertedWith("Pausable: not paused");

        await nft.connect(owner).pause();
        expect(await nft.paused()).to.be.true;

        await expect(
            nft.connect(owner).pause()
        ).to.be.revertedWith("Pausable: paused");
        expect(await nft.paused()).to.be.true;

        await expect(
            nft.redeem([], [])
        ).to.be.revertedWith("Pausable: paused");

        await nft.connect(owner).unpause();
        expect(await nft.paused()).to.be.false;
    });

    it("should be ERC1155", async function() {
        expect(await nft.uri(1)).to.equal("some_url");

        let tokenIds = [1, 2, 3, 4, 5];
        let supplies = [100, 200, 300, 400, 500];

        // mint and check balance
        await nft.connect(owner).mint(user1.address, tokenIds, supplies);
        for (let i = 0; i < tokenIds.length; i++) {
            let balance = await nft.balanceOf(
                user1.address,
                ethers.BigNumber.from(tokenIds[i])
            );
            expect(balance.eq(supplies[i])).to.be.true;
        }

        // transfer and balance
        await nft.safeTransferFrom(
            user1.address, user2.address, 2, 50, []
        );
        let balance = await nft.balanceOf(user1.address, 2);
        expect(balance.eq(150)).to.be.true;
        balance = await nft.balanceOf(user2.address, 2);
        expect(balance.eq(50)).to.be.true;

        // batch transfer and balance
        await nft.safeBatchTransferFrom(
            user1.address, user2.address, [2, 3], [100, 200], []
        );
        let [
            balance12, balance13, balance22, balance23
        ] = await nft.balanceOfBatch(
            [user1.address, user1.address, user2.address, user2.address],
            [2, 3, 2, 3]
        );
        expect(balance12.eq(50)).to.be.true;
        expect(balance13.eq(100)).to.be.true;
        expect(balance22.eq(150)).to.be.true;
        expect(balance23.eq(200)).to.be.true;

        // approve user2 for user1
        await nft.connect(user1).setApprovalForAll(user2.address, true);
        expect(
            await nft.isApprovedForAll(user1.address, user2.address)
        ).to.be.true;

        // user2 transfer on behalf of user1
        await nft.connect(user2).safeTransferFrom(
            user1.address, user2.address, 3, 50, []
        );
        [balance13, balance23] = await nft.balanceOfBatch(
            [user1.address, user2.address],
            [3, 3]
        );
        expect(balance13.eq(50)).to.be.true;
        expect(balance23.eq(250)).to.be.true;

        // user2 batch transfer on behalf of user1
        await nft.safeBatchTransferFrom(
            user1.address, user2.address, [2, 3], [50, 50], []
        );
        [
            balance12, balance13, balance22, balance23
        ] = await nft.balanceOfBatch(
            [user1.address, user1.address, user2.address, user2.address],
            [2, 3, 2, 3]
        );
        expect(balance12.eq(0)).to.be.true;
        expect(balance13.eq(0)).to.be.true;
        expect(balance22.eq(200)).to.be.true;
        expect(balance23.eq(300)).to.be.true;
    });

    it("should be redeemable", async function() {
        await nft.connect(owner).mint(user1.address, [1, 2], [100, 200]);

        const AdminFactory = await ethers.getContractFactory(
            "DeMineNFTAdminTest"
        );
        admin = await AdminFactory.deploy();
        await admin.deployed();
        await nft.connect(owner).transferOwnership(admin.address);
        await expect(
            nft.connect(user1).redeem([1, 2], [50, 100])
        ).to.emit(admin, "Redeem").withArgs(
            user1.address, 1, 1, [1, 2], [50, 100]
        );
        expect((await nft.balanceOf(user1.address, 1)).eq(50)).to.be.true;
        expect((await nft.balanceOf(user1.address, 2)).eq(100)).to.be.true;
    });
});

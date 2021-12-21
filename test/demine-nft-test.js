const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeMineNFT", function () {
    const name = "DeMineNFTCloneFactory";
    var owner;
    var user1;
    var user2;
    var nftFactory;
    var nft;

    before(async function() {
        [user1, user2, owner] = await ethers.getSigners();
        const NFTFactory = await ethers.getContractFactory(name);
        nftFactory = await NFTFactory.deploy();
        await nftFactory.deployed();
    });

    beforeEach(async function() {
        const NFT = await ethers.getContractFactory("DeMineNFT");
        const tx = await nftFactory.create("some_url", 100, owner.address)
        const { gasUsed: createGasUsed, events } = await tx.wait();
        const { address } = events.find(Boolean);
        console.log(`${name}.createToken: ${createGasUsed.toString()}`);
        nft = await NFT.attach(address);
    });

    it("should with royalty info", async function () {
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

        let tokenIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let supplies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

        // mint and check balance
        await nft.connect(owner).mint(user1.address, tokenIds, supplies);
        for (let i = 0; i <= tokenIds.length; i++) {
            expect(
                await nft.balanceOf(user1.address, tokenIds[i])
            ).to.equal(supplies[i]);
        }

        // transfer
        await nft.safeTransferFrom(
            user1.address, user2.address, tokenIds[0], supplies[0], ""
        );
        expect(
            await nft.balanceOf(user2.address, tokenIds[0])
        ).to.equal(supplies[0]);

        // check balanceoOfBatch
        expect(
            await nft.balanceOfBatch(
                [user1.address, user2.address], [tokenIds[0], tokenIds[1]]
            )
        ).to.equal([0, 0]);
        expect(
            await nft.balanceOfBatch(
                [user2.address, user1, address], [tokenIds[0], tokenIds[1]]
            )
        ).to.equal([supplies[0], supplies[1]]);
    });
});

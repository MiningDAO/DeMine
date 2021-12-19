const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeMineNFT", function () {
    const name = "DeMineNFTCloneFactory";
    var owner;
    var user;
    var nftFactory;
    var nft;

    before(async function() {
        [user, owner] = await ethers.getSigners();
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
            nft.connect(user).mint(user.address, [], [])
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
            nft.connect(user).pause()
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
            nft.connect(user).unpause()
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
});


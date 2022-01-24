const { expect } = require("chai");
const hre = require("hardhat");

describe("DeMineNFT", function () {
    var nft;

    beforeEach(async function() {
        await hre.deployments.fixture(['DeMine']);
        nft = hre.run('clone-demine-nft', { coin: 'btc' });
    });

    it("DeMineAdmin", async function () {
        const { deployer, admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('DeMineAdminFacet', nft);
        // SafeOwnable
        expect(await facet.owner()).to.equal(admin.address);
        await facet.connect(admin).transferOwnership(deployer.address);
        expect(await facet.nomineeOwner()).to.equal(deployer.address);
        await facet.connect(deployer).acceptOwnership();
        expect(await facet.owner()).to.equal(deployer.address);
        // Pausable
        expect(await facet.paused()).to.be.false;
        await facet.connect(deployer).pause();
        expect(await facet.paused()).to.be.true;

        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        await expect(
            erc1155.connect(
                custodian
            ).safeTransferFrom(
                custodian.address, admin.address, [0, 1, 2], [50, 50, 50], []
            )
        ).to.be.revertedWith("Pausable: paused");

        const pool = await hre.ethers.getContractAt('MiningPoolFacet', nft);
        await expect(
            pool.connect(custodian).shrink(custodian.address, [0, 1])
        ).to.be.revertedWith("Pausable: paused");
        await expect(
            pool.connect(custodian).alchemize(custodian.address, [0, 1])
        ).to.be.revertedWith("Pausable: paused");

        await facet.connect(deployer).unpause();
        expect(await facet.paused()).to.be.false;
    });
});

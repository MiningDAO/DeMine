const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./demine-test-utils.js");

const address0 = hre.ethers.utils.getAddress(
    "0x0000000000000000000000000000000000000000"
);

async function facetAddress(name) {
    const facet = await hre.deployments.get(name);
    return facet.address;
}

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
                custodian.address, admin.address, 0, 50, []
            )
        ).to.be.revertedWith("Pausable: paused");
        await expect(
            erc1155.connect(
                custodian
            ).safeBatchTransferFrom(
                custodian.address, admin.address, [0, 1], [50, 50], []
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

    it("Diamond", async function () {
        const { admin } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('DiamondFacet', nft);

        const adminFacet = await facetAddress('DeMineAdminFacet');
        const expected = {
            [adminFacet]: 7,
            [await facetAddress('DiamondFacet')]: 7,
            [await facetAddress('ERC1155Facet')]: 12,
            [await facetAddress('MiningPoolFacet')]: 6
        };

        // IDiamondLoupe
        const facets = await facet.facets();
        for (let [facet, selectors] of facets) {
            expect(selectors.length).to.equal(expected[facet]);
        }

        var selectors = await facet.facetFunctionSelectors(adminFacet);
        expect(selectors.length).to.equal(expected[adminFacet]);

        const addresses = await facet.facetAddresses();
        const expectedAddresses = Object.keys(expected);
        expect(addresses).to.include.members(expectedAddresses);

        const artifact = await hre.deployments.getArtifact('Ownable');
        const iface = new hre.ethers.utils.Interface(artifact.abi);
        const selector = iface.getSighash('owner');
        expect(await facet.facetAddress(selector)).to.equal(adminFacet);

        await facet.connect(admin).diamondCut([[address0, 2, [selector]]], address0, []);
        selectors = await facet.facetFunctionSelectors(adminFacet);
        expect(selectors.length).to.equal(expected[adminFacet] - 1);
        expect(await facet.facetAddress(selector)).to.equal(address0);
    });

    it("IERC1155", async function () {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const ids = [1, 2, 3];
        const amounts = [150, 150, 150];

        // mint and burn
        await facet.connect(admin).mintBatch(custodian.address, ids, amounts, []);
        const accounts = Array(3).fill(custodian.address);
        utils.compareArray(await facet.balanceOfBatch(accounts, ids), amounts);
        await facet.connect(custodian).burnBatch(custodian.address, ids, [50, 50, 50]);
        utils.compareArray(await facet.balanceOfBatch(accounts, ids), [100, 100, 100]);

        // transfer and batch transfer
        await facet.connect(custodian).safeTransferFrom(
            custodian.address, admin.address, 1, 50, []
        );
        expect(await facet.balanceOf(custodian.address, 1)).to.equal(50);
        expect(await facet.balanceOf(admin.address, 1)).to.equal(50);

        await facet.connect(custodian).safeBatchTransferFrom(
            custodian.address, admin.address, [2, 3], [20, 20], []
        );
        expect(await facet.balanceOf(custodian.address, 2)).to.equal(80);
        expect(await facet.balanceOf(custodian.address, 3)).to.equal(80);
        expect(await facet.balanceOf(admin.address, 2)).to.equal(20);
        expect(await facet.balanceOf(admin.address, 3)).to.equal(20);

        // isApprovedForAll and setApprovedForAll
        expect(await facet.isApprovedForAll(custodian.address, admin.address)).to.be.false;
        await expect(
            facet.connect(admin).safeTransferFrom(
                custodian.address, admin.address, 1, 50, []
            )
        ).to.be.revertedWith('ERC1155: caller is not owner nor approved');
        await expect(
            facet.connect(admin).safeBatchTransferFrom(
                custodian.address, admin.address, [2, 3], [20, 20], []
            )
        ).to.be.revertedWith('ERC1155: caller is not owner nor approved');
        await expect(
            facet.connect(admin).burnBatch(custodian.address, [2, 3], [20, 20])
        ).to.be.revertedWith('ERC1155: caller is not owner nor approved');

        await facet.connect(custodian).setApprovalForAll(admin.address, true);
        expect(await facet.isApprovedForAll(custodian.address, admin.address)).to.be.true;
        await facet.connect(admin).safeTransferFrom(
            custodian.address, admin.address, 1, 50, []
        );
        expect(await facet.balanceOf(custodian.address, 1)).to.equal(0);
        expect(await facet.balanceOf(admin.address, 1)).to.equal(100);

        await facet.connect(admin).safeBatchTransferFrom(
            custodian.address, admin.address, [2, 3], [20, 20], []
        );
        expect(await facet.balanceOf(custodian.address, 2)).to.equal(60);
        expect(await facet.balanceOf(custodian.address, 3)).to.equal(60);
        expect(await facet.balanceOf(admin.address, 2)).to.equal(40);
        expect(await facet.balanceOf(admin.address, 3)).to.equal(40);

        await facet.connect(custodian).setApprovalForAll(admin.address, false);
        expect(await facet.isApprovedForAll(custodian.address, admin.address)).to.be.false;
    });

    it("IERC1155Metadata", async function () {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const baseUri = hre.localConfig.tokenUri;
        expect(await facet.uri(1)).to.equal(baseUri + '1');

        const newBaseUri = 'https://www.tokeninfo.com/token/';
        await facet.connect(admin).setURI(newBaseUri);
        expect(await facet.uri(1)).to.equal(newBaseUri + '1');
    });

    it('IERC2981', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);

        utils.compareArray(await facet.royaltyInfo(1, 1000), [custodian.address, 10]);
        await facet.connect(admin).setRoyaltyInfo(admin.address, 1000);
        utils.compareArray(await facet.royaltyInfo(1, 1000), [admin.address, 100]);
    });

    it('MiningPoolFacet', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();

        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const ids = [1, 2, 3, 4, 5];
        const amounts = [100, 100, 100, 100, 100];
        await facet.connect(admin).mintBatch(custodian.address, ids, amounts, []);

        const pool = await hre.ethers.getContractAt('MiningPoolFacet', nft);
    });
});

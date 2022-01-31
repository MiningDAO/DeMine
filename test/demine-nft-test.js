const { expect } = require("chai");
const common = require("../lib/common.js");
const hre = require("hardhat");
const address0 = hre.ethers.constants.AddressZero;

async function facetAddress(name) {
    const facet = await hre.deployments.get(name);
    return facet.address;
}

async function cloneWrapped(coin) {
    const { admin } = await hre.ethers.getNamedSigners();
    const diamond = await common.getDeployment(hre, 'Diamond');

    const wrappedConfig = hre.localConfig.wrapped[coin];
    const fallback = await common.getDeployment(hre, 'ERC20Facet');
    const initArgs = await common.diamondInitArgs(
        hre,
        admin.address,
        fallback.address,
        ethers.utils.defaultAbiCoder.encode(
            ["string", "string", "uint8"],
            [
                wrappedConfig.name,
                wrappedConfig.symbol,
                wrappedConfig.decimals
            ]
        ),
        [],
        ['@solidstate/contracts/token/ERC20/IERC20.sol:IERC20']
    );
    const Base = await common.getDeployment(hre, 'Diamond');
    const tx = await Base.create(initArgs);
    const { events: events } = await tx.wait();
    const { args: [from, cloned] } = events.find(
        function(e) { return e.event === 'Clone'; }
    );
    return cloned;
}

async function cloneNFT(coin) {
    const { admin, custodian } = await hre.ethers.getNamedSigners();
    const fallback = await common.getDeployment(hre, 'ERC1155Facet');
    const rewardToken = await cloneWrapped(coin);
    const uri = localConfig.tokenUri[coin];
    const initArgs = await common.diamondInitArgs(
        hre,
        admin.address,
        fallback.address,
        ethers.utils.defaultAbiCoder.encode(
            ["address", "uint8", "address", "string"],
            [custodian.address, 100, rewardToken, uri]
        ),
        [],
        ['IERC1155Rewardable']
    );
    const Base = await common.getDeployment(hre, 'Diamond');
    const tx = await Base.create(initArgs);
    const { events: events } = await tx.wait();
    const { args: [from, cloned] } = events.find(
        function(e) { return e.event === 'Clone'; }
    );
    return cloned;
}

const checkEvent = async function(tx, address, name, expectedArgs) {
    const { events } = await tx.wait();
    const { args: args } = events.find(
        function(e) {
            return e.event === name && e.address === address;
        }
    );
    common.compareArray(args, expectedArgs);
}

describe("DeMineNFT", function () {
    const coin = 'btc';
    var nft;

    beforeEach(async function() {
        await hre.deployments.fixture(['DeMine']);
        nft = await cloneNFT(coin);
    });

    it("DiamondAdmin", async function () {
        const { deployer, admin, custodian } = await hre.ethers.getNamedSigners();
        const main = await hre.ethers.getContractAt('Diamond', nft);
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);

        // SafeOwnable
        expect(await main.owner()).to.equal(admin.address);
        await main.connect(admin).transferOwnership(deployer.address);
        expect(await main.nomineeOwner()).to.equal(deployer.address);
        await main.connect(deployer).acceptOwnership();
        expect(await main.owner()).to.equal(deployer.address);

        // Pausable
        expect(await main.paused()).to.be.false;
        await main.connect(deployer).pause();
        expect(await main.paused()).to.be.true;

        // mint not paused
        await erc1155.connect(deployer).mintBatch(
            custodian.address, [1, 2], [50, 50], []
        );

        // normal transfer not paused
        await erc1155.connect(
            custodian
        ).safeBatchTransferFrom(
            custodian.address, admin.address, [1, 2], [49, 49], []
        );
        // transfer to alchemist paused
        await erc1155.connect(deployer).finalize(0),
        await erc1155.connect(deployer).finalize(0),
        await erc1155.connect(deployer).finalize(0),
        await expect(
            erc1155.connect(
                custodian
            ).safeBatchTransferFrom(
                custodian.address,
                await erc1155.getAlchemist(),
                [1, 2],
                [50, 50],
                []
            )
        ).to.be.revertedWith("Pausable: paused");

        await main.connect(deployer).unpause();
        expect(await main.paused()).to.be.false;
    });

    it("Diamond", async function () {
        const { admin } = await hre.ethers.getNamedSigners();
        const main = await hre.ethers.getContractAt('Diamond', nft);

        // IDiamondLoupe
        const facets = await main.facets();
        expect(facets.length).to.be.equal(0);

        const addresses = await main.facetAddresses();
        expect(addresses.length).to.be.equal(0);
    });

    it("IERC1155", async function () {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const ids = [1, 2, 3];
        const amounts = [100, 100, 100];

        // mint and burn
        await facet.connect(admin).mintBatch(custodian.address, ids, amounts, []);
        const accounts = Array(3).fill(custodian.address);
        common.compareArray(await facet.balanceOfBatch(accounts, ids), amounts);

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
        const baseUri = hre.localConfig.tokenUri[coin];
        expect(await facet.uri(1)).to.equal(baseUri + '1');

        const newBaseUri = 'https://www.tokeninfo.com/token/';
        await facet.connect(admin).setURI(newBaseUri);
        expect(await facet.uri(1)).to.equal(newBaseUri + '1');
    });

    it('IERC2981', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);

        common.compareArray(await facet.royaltyInfo(1, 1000), [custodian.address, 10]);
        await facet.connect(admin).setRoyaltyInfo(admin.address, 1000);
        common.compareArray(await facet.royaltyInfo(1, 1000), [admin.address, 100]);
    });

    it('Mining', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();

        // setup
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const ids = [1, 2, 3, 4, 5];
        const amounts = [100, 200, 300, 400, 500];
        await erc1155.connect(admin).mintBatch(custodian.address, ids, amounts, []);
        await erc1155.connect(admin).mintBatch(admin.address, ids, amounts, []);

        const incomeAddr = await erc1155.getRewardToken();
        expect(incomeAddr).to.be.not.equal(address0); const income = await hre.ethers.getContractAt('ERC20Facet', incomeAddr);
        await income.connect(admin).mint(custodian.address, 1000);
        await income.connect(custodian).approve(nft, 1000);

        // finalize
        expect(await erc1155.getMiningToken()).to.equal(0);
        checkEvent(
            await erc1155.connect(admin).finalize(0),
            nft,
            'Finalize',
            [0, 0]
        );
        expect(await erc1155.getMiningToken()).to.equal(1);
        var [tokenInfo] = await erc1155.getTokenInfo([0]);
        common.compareArray(tokenInfo, [0, 0]);
        expect(await income.balanceOf(custodian.address)).to.equal(1000);

        await income.connect(custodian).transfer(nft, 200);
        checkEvent(
            await erc1155.connect(admin).finalize(1),
            nft,
            'Finalize',
            [1, 1]
        );

        expect(await erc1155.getMiningToken()).to.equal(2);
        [tokenInfo] = await erc1155.getTokenInfo([1]);
        common.compareArray(tokenInfo, [200, 1]);

        await income.connect(custodian).transfer(nft, 800);
        checkEvent(
            await erc1155.connect(admin).finalize(2),
            nft,
            'Finalize',
            [2, 2]
        );
        expect(await erc1155.getMiningToken()).to.equal(3);
        [tokenInfo] = await erc1155.getTokenInfo([2]);
        common.compareArray(tokenInfo, [400, 2]);

        // alchemize
        const alchemist = await erc1155.getAlchemist();
        await expect(
            erc1155.connect(custodian).safeTransferFrom(
                custodian.address, alchemist, [1, 2, 3], [1, 1, 1], []
            )
        ).to.be.revertedWith('DeMineNFT: token not mined')

        checkEvent(
            await erc1155.connect(custodian).safeBatchTransferFrom(
                custodian.address, alchemist, [1, 2], [100, 200], []
            ),
            nft,
            'Alchemy',
            [custodian.address, 500]
        );

        const signer = new ethers.Wallet(
            "0x65789150d0cb0485988f6488122eae027af2a116e202c65bff207d2b605b57cb",
            ethers.provider
        );
        await admin.sendTransaction(
            {to: signer.address, value: ethers.utils.parseEther("1.0")}
        );
        expect(await erc1155.getAlchemist(), signer.address);
        await expect(
            erc1155.connect(signer).safeTransferFrom(
                alchemist, admin.address, [1, 2], [100, 200], []
            )
        ).to.be.revertedWith('DeMineNFT: from alchemist');

        expect(await income.balanceOf(custodian.address)).to.equal(500);
        expect(await income.balanceOf(nft)).to.equal(500);
        expect(await erc1155.balanceOf(custodian.address, 1)).to.equal(0);
        expect(await erc1155.balanceOf(custodian.address, 2)).to.equal(0);
    });
});

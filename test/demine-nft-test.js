const { expect } = require("chai");
const utils = require("../lib/utils.js");
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const diamond = require("../lib/diamond.js");
const config = require("../lib/config.js");
const hre = require("hardhat");
const address0 = hre.ethers.constants.AddressZero;

const { logger } = require('../lib/logger.js');
const console = logger.transports.find(
    t => t.name == 'console'
);
console.level = 'warn';

async function facetAddress(name) {
    const facet = await hre.deployments.get(name);
    return facet.address;
}

function genTokenIds(startDate, endDate, type) {
    start = time.toEpoch(new Date(startDate));
    end = time.toEpoch(new Date(endDate)) + 86400;
    return token.genTokenIds(start, end, type)
}

describe("DeMineNFT", function () {
    const coin = 'btc';
    var nft, custodian, erc1155;
    var deployer, admin;

    beforeEach(async function() {
        const signers = await hre.ethers.getNamedSigners();
        admin = signers.admin;
        deployer = signers.deployer;
        await hre.deployments.fixture(['Local', 'NFT']);
        nft = await hre.run('nft-clone', {coin: coin});
        erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        custodian = await ethers.getContractAt(
            'ERC1155Custodian',
            await erc1155.custodian()
        );
        await hre.run('nft-admin-custody', {coin: coin, nft: nft});
    });

    it("Initializable", async function() {
        const erc20Addr = await erc1155.earningToken();
        const erc20 = await hre.ethers.getContractAt('Diamond', erc20Addr)

        const iface = new hre.ethers.utils.Interface([
            'function init(address earningToken)'
        ]);
        const fallback = await config.getDeployment(hre, 'ERC1155Facet');
        await expect(
          erc20.init([
              admin.address,
              await diamond.genInterfaces(
                  hre,
                  ['@solidstate/contracts/token/ERC1155/IERC1155.sol:IERC1155']
              ),
              fallback.address,
              iface.encodeFunctionData('init', [erc20Addr])
          ])
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("TokenId", async function() {
        var tokenIds = genTokenIds('2022-02-02', '2022-02-05', 'daily');
        expect(tokenIds.length).to.equal(4);

        tokenIds = genTokenIds('2022-02-03', '2022-02-18', 'weekly');
        expect(tokenIds.length).to.equal(2);
        tokenIds = genTokenIds('2022-02-04', '2022-02-17', 'weekly');
        expect(tokenIds.length).to.equal(1);

        tokenIds = genTokenIds('2022-02-03', '2022-03-10', 'biweekly');
        expect(tokenIds.length).to.equal(2);
        tokenIds = genTokenIds('2022-02-04', '2022-03-10', 'biweekly');
        expect(tokenIds.length).to.equal(1);
    });

    it("Custody", async function() {
        expect(await erc1155.custodian()).to.equal(custodian.address);
        expect(await custodian.owner()).to.equal(admin.address);
        expect(
            await erc1155.isApprovedForAll(custodian.address, admin.address)
        ).to.be.true;

        // mint
        var tokenIds = genTokenIds('2022-02-12', '2022-02-13', 'daily')
        var encoded = token.encode(tokenIds);
        await erc1155.connect(admin).mint(encoded, [50, 50], []);
        expect(await erc1155.balanceOf(custodian.address, encoded[0])).to.equal(50);
        expect(await erc1155.balanceOf(admin.address, encoded[0])).to.equal(0);

        // transfer
        await erc1155.connect(admin).safeTransferFrom(
            custodian.address, admin.address, encoded[0], 50, []
        );
        expect(await erc1155.balanceOf(custodian.address, encoded[0])).to.equal(0);
        expect(await erc1155.balanceOf(admin.address, encoded[0])).to.equal(50);

        await expect(
            custodian.connect(deployer).custody(nft, admin.address, false)
        ).to.be.revertedWith('Ownable: caller is not the owner');
        await custodian.connect(admin).custody(nft, admin.address, false);
    });

    it("DiamondAdmin", async function () {
        const main = await hre.ethers.getContractAt('Diamond', nft);
        const earningToken = await erc1155.earningToken();

        // Pausable
        expect(await main.paused()).to.be.false;
        await expect(
            main.connect(deployer).pause()
        ).to.be.revertedWith('Ownable: sender must be owner');
        await main.connect(admin).pause();
        expect(await main.paused()).to.be.true;

        // mint not paused
        var tokenIds = genTokenIds('2022-02-12', '2022-02-13', 'daily')
        var encoded = token.encode(tokenIds);
        await expect(
            erc1155.connect(deployer).mint(encoded, [50, 50], [])
        ).to.be.revertedWith('Ownable: sender must be owner');
        await erc1155.connect(admin).mint(encoded, [50, 50], []);

        // normal transfer not paused
        await erc1155.connect(
            admin
        ).safeBatchTransferFrom(
            custodian.address, admin.address, encoded, [49, 49], []
        );

        // transfer to custodian paused
        await erc1155.connect(admin).finalize(
            tokenIds[1].endTs, 0, admin.address, 0
        );
        await expect(
            erc1155.connect(
                admin
            ).safeBatchTransferFrom(
                admin.address,
                await erc1155.custodian(),
                encoded,
                [50, 50],
                []
            )
        ).to.be.revertedWith("Pausable: paused");

        await main.connect(admin).unpause();
        expect(await main.paused()).to.be.false;

        //set fallback address
        const fallback = await config.getDeployment(hre, 'ERC1155Facet');
        expect(
            await main.connect(deployer).getFallbackAddress()
        ).to.equal(fallback.address);
        await expect(
            main.connect(deployer).setFallbackAddress(earningToken)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await main.connect(admin).setFallbackAddress(earningToken);
        expect(
            await main.connect(deployer).getFallbackAddress()
        ).to.equal(earningToken);

        // SafeOwnable
        expect(await main.owner()).to.equal(admin.address);
        await main.connect(admin).transferOwnership(deployer.address);
        expect(await main.nomineeOwner()).to.equal(deployer.address);
        await main.connect(deployer).acceptOwnership();
        expect(await main.owner()).to.equal(deployer.address);
    });

    it("Diamond", async function () {
        const contract = await hre.ethers.getContractAt('IDiamondCuttable', nft);

        // IDiamondCuttable
        const erc20 = await config.getDeployment(hre, 'ERC20Facet');
        const facetCut = await diamond.genFacetCut(
            hre,
            'ERC20Facet',
            [
                [
                    '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20',
                    ['transfer', 'allowance', 'approve']
                ],
            ]
        );
        await expect(
            contract.connect(deployer).diamondCut(
                [facetCut], address0, []
            )
        ).to.be.revertedWith('Ownable: sender must be owner');
        await contract.connect(admin).diamondCut([facetCut], address0, []);

        // IDiamondLoupe
        const loupe = await hre.ethers.getContractAt('IDiamondLoupe', nft);
        const facets = await loupe.facets();
        expect(facets.length).to.be.equal(1);

        const selectors = await loupe.facetFunctionSelectors(erc20.address);
        expect(selectors.length).to.be.equal(3);

        const addresses = await loupe.facetAddresses();
        expect(addresses.length).to.be.equal(1);

        const facetAddress = await loupe.facetAddress(selectors[0]);
        expect(facetAddress).to.be.equal(erc20.address);
    });

    it("IERC1155", async function () {
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const ids = genTokenIds('2022-02-02', '2022-02-04', 'daily');
        const [id1, id2, id3] = encoded = token.encode(ids);
        const amounts = [100, 100, 100];

        // mint
        await facet.connect(admin).mint(encoded, amounts, []);
        const accounts = Array(3).fill(custodian.address);
        utils.compareArray(
            await facet.balanceOfBatch(accounts, encoded),
            amounts
        );
        // transfer and batch transfer
        await facet.connect(admin).safeTransferFrom(
            custodian.address, deployer.address, id1, 50, []
        );
        expect(await facet.balanceOf(custodian.address, id1)).to.equal(50);
        expect(await facet.balanceOf(deployer.address, id1)).to.equal(50);

        await facet.connect(admin).safeBatchTransferFrom(
            custodian.address, deployer.address, [id2, id3], [20, 20], []
        );
        expect(await facet.balanceOf(custodian.address, id2)).to.equal(80);
        expect(await facet.balanceOf(custodian.address, id3)).to.equal(80);
        expect(await facet.balanceOf(deployer.address, id2)).to.equal(20);
        expect(await facet.balanceOf(deployer.address, id3)).to.equal(20);

        // isApprovedForAll and setApprovedForAll
        expect(await facet.isApprovedForAll(deployer.address, admin.address)).to.be.false;
        await expect(
            facet.connect(admin).safeTransferFrom(
                deployer.address, admin.address, id1, 50, []
            )
        ).to.be.revertedWith('ERC1155: caller is not owner nor approved');
        await expect(
            facet.connect(admin).safeBatchTransferFrom(
                deployer.address, admin.address, [id2, id3], [20, 20], []
            )
        ).to.be.revertedWith('ERC1155: caller is not owner nor approved');

        await facet.connect(deployer).setApprovalForAll(admin.address, true);
        expect(await facet.isApprovedForAll(deployer.address, admin.address)).to.be.true;
        await facet.connect(admin).safeTransferFrom(
            deployer.address, admin.address, id1, 50, []
        );
        expect(await facet.balanceOf(deployer.address, id1)).to.equal(0);
        expect(await facet.balanceOf(admin.address, id1)).to.equal(50);

        await facet.connect(admin).safeBatchTransferFrom(
            deployer.address, admin.address, [id2, id3], [20, 20], []
        );
        expect(await facet.balanceOf(deployer.address, id2)).to.equal(0);
        expect(await facet.balanceOf(deployer.address, id3)).to.equal(0);
        expect(await facet.balanceOf(admin.address, id2)).to.equal(20);
        expect(await facet.balanceOf(admin.address, id3)).to.equal(20);

        await facet.connect(deployer).setApprovalForAll(admin.address, false);
        expect(await facet.isApprovedForAll(deployer.address, admin.address)).to.be.false;
    });

    it("IERC1155Metadata", async function () {
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);
        expect(await facet.uri(1)).to.equal('');

        const uri = token.uri(hre, coin);
        await expect(
            facet.connect(deployer).setURI(uri)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).setURI(uri);
        expect(await facet.uri(1)).to.equal(uri + '1');
    });

    it('IERC165', async function() {
        const base = await hre.ethers.getContractAt('Diamond', nft);

        expect(
            await base.supportsInterface(
                await diamond.genInterface(
                    hre,
                    '@solidstate/contracts/token/ERC1155/IERC1155.sol:IERC1155'
                )
            )
        ).to.be.true;

        const iface = await diamond.genInterface(
            hre,
            '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20'
        );

        expect(await base.supportsInterface(iface)).to.be.false;
        await expect(
            base.connect(deployer).setSupportedInterface(iface, true)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await base.connect(admin).setSupportedInterface(iface, true);

        expect(await base.supportsInterface(iface)).to.be.true;
    });

    it('IERC2981', async function() {
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);

        utils.compareArray(await facet.royaltyInfo(1, 1000), [admin.address, 10]);
        await expect(
            facet.connect(deployer).setRoyaltyInfo(admin.address, 1000)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).setRoyaltyInfo(admin.address, 1000);
        utils.compareArray(await facet.royaltyInfo(1, 1000), [admin.address, 100]);
    });

    it('Mining', async function() {
        // setup
        const incomeAddr = await erc1155.earningToken();
        expect(incomeAddr).to.be.not.equal(address0);
        const income = await hre.ethers.getContractAt('ERC20Facet', incomeAddr);
        await income.connect(admin).mint(admin.address, 10000000);
        await income.connect(admin).approve(nft, 10000000);

        // mint
        const daily = genTokenIds('2022-02-02', '2022-12-02', 'daily');
        const days = function(start, end) {
            return Math.floor(
                (
                    new Date(end).getTime() + 86400000 - new Date(start).getTime()
                ) / 86400000
            );
        };
        expect(daily.length).to.equal(days('2022-02-02', '2022-12-02'));
        const dailyAmounts = Array(daily.length).fill(100);
        await erc1155.connect(admin).mint(token.encode(daily), dailyAmounts, []);

        const weekly = genTokenIds('2022-02-02', '2022-11-29', 'weekly');
        const weeks = function(start, end) {
            return Math.floor(
                (
                    new Date(end).getTime() + 86400000 - new Date(start).getTime()
                ) / (86400000 * 7)
            );
        };
        expect(weekly.length).to.equal(weeks('2022-02-03', '2022-11-29'));
        const weeklyAmounts = Array(weekly.length).fill(200);
        await erc1155.connect(admin).mint(token.encode(weekly), weeklyAmounts, []);

        const biweekly = genTokenIds('2022-02-02', '2022-11-22', 'biweekly');
        const biweeks = function(start, end) {
            return Math.floor(
                (
                    new Date(end).getTime() + 86400000- new Date(start).getTime()
                ) / (86400000 * 7 * 2)
            );
        };
        expect(biweekly.length).to.equal(biweeks('2022-02-03', '2022-11-22'));
        const biweeklyAmounts = Array(biweekly.length).fill(300);
        await erc1155.connect(admin).mint(
            token.encode(biweekly), biweeklyAmounts, []
        );

        // release
        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian.address,
            deployer.address,
            [
                token.encodeOne(daily[13]),
                token.encodeOne(daily[14]),
                token.encodeOne(weekly[0]),
                token.encodeOne(weekly[1]),
                token.encodeOne(biweekly[0])
            ],
            [100, 100, 100, 100, 100],
            []
        );

        // finalize
        const finalize = async function(date, reward) {
            const prev = await income.balanceOf(nft);
            const finalized = time.toEpoch(new Date(date));
            await erc1155.connect(admin).finalize(
                finalized, reward, admin.address, reward * 600
            );
            const post = await income.balanceOf(nft);
            expect(post.sub(prev)).to.equal(reward * 600);
            expect(await erc1155.finalized()).to.equal(finalized);
        };

        await expect(
            erc1155.connect(admin).finalize(
                time.toEpoch(new Date('2022-02-02T12:00:00Z')),
                1,
                admin.address,
                600
            )
        ).to.be.revertedWith('NFT: invalid timestamp')

        const earning = async function(id) {
            return await erc1155.earning(token.encodeOne(id));
        };
        const earningBatch = async function(ids) {
            return await erc1155.earningBatch(token.encode(ids));
        };

        await finalize('2022-02-03', 1);
        expect(await earning(daily[0])).to.equal(1);
        expect(await earning(weekly[0])).to.equal(0);
        expect(await earning(biweekly[0])).to.equal(0);
        utils.compareArray(
            await earningBatch([daily[0], weekly[0], biweekly[0]]),
            [1, 0, 0]
        ),

        // finalize already finalized
        await expect(
            erc1155.connect(admin).finalize(
                time.toEpoch(new Date('2022-02-02')), 1, admin.address, 600
            )
        ).to.be.revertedWith('NFT: invalid timestamp')

        await finalize('2022-02-09', 2);
        expect(await earning(daily[6])).to.equal(2);
        expect(await earning(weekly[0])).to.equal(2);
        expect(await earning(biweekly[0])).to.equal(2);
        utils.compareArray(
            await earningBatch([daily[6], weekly[0], biweekly[0]]),
            [2, 2, 2]
        );

        await finalize('2022-02-10', 3);
        expect(await earning(daily[7])).to.equal(3);
        expect(await earning(weekly[0])).to.equal(5);
        expect(await earning(biweekly[0])).to.equal(5);
        utils.compareArray(
            await earningBatch([daily[7], weekly[0], biweekly[0]]),
            [3, 5, 5]
        );

        await finalize('2022-02-16', 4);
        expect(await earning(daily[13])).to.equal(4);
        expect(await earning(weekly[1])).to.equal(4);
        expect(await earning(biweekly[0])).to.equal(9);
        utils.compareArray(
            await earningBatch([daily[13], weekly[1], biweekly[0]]),
            [4, 4, 9]
        );

        await finalize('2022-02-17', 5);
        expect(await earning(daily[14])).to.equal(5);
        expect(await earning(weekly[1])).to.equal(9);
        expect(await earning(biweekly[0])).to.equal(14);
        utils.compareArray(
            await earningBatch([daily[14], weekly[1], biweekly[0]]),
            [5, 9, 14]
        );

        await finalize('2022-02-18', 6);
        expect(await earning(daily[15])).to.equal(6);
        expect(await earning(weekly[2])).to.equal(6);
        expect(await earning(biweekly[1])).to.equal(6);
        utils.compareArray(
            await earningBatch([daily[15], weekly[2], biweekly[1]]),
            [6, 6, 6]
        );

        // alchemize
        await erc1155.connect(deployer).safeBatchTransferFrom(
            deployer.address,
            custodian.address,
            [
                token.encodeOne(daily[13]),
                token.encodeOne(daily[14]),
                token.encodeOne(weekly[0]),
                token.encodeOne(weekly[1]),
                token.encodeOne(biweekly[0])
            ],
            [100, 100, 100, 100, 100],
            []
        );
        expect(await income.balanceOf(nft)).to.equal(8900);

        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian.address,
            custodian.address,
            [
                token.encodeOne(daily[13]),
                token.encodeOne(daily[14]),
                token.encodeOne(weekly[0]),
                token.encodeOne(weekly[1]),
                token.encodeOne(biweekly[0])
            ],
            [100, 100, 100, 100, 100],
            []
        );
        expect(await income.balanceOf(nft)).to.equal(8900);

        const balanceOf = async function(address, id) {
            return await erc1155.balanceOf(address, token.encodeOne(id));
        };
        expect(await balanceOf(deployer.address, daily[13])).to.equal(0);
        expect(await balanceOf(deployer.address, daily[14])).to.equal(0);
        expect(await balanceOf(deployer.address, weekly[0])).to.equal(0);
        expect(await balanceOf(deployer.address, weekly[1])).to.equal(0);
        expect(await balanceOf(deployer.address, biweekly[0])).to.equal(0);
    });
});

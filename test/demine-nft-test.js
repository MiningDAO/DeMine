const { expect } = require("chai");
const common = require("../lib/common.js");
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const diamond = require("../lib/diamond.js");
const hre = require("hardhat");
const address0 = hre.ethers.constants.AddressZero;

async function facetAddress(name) {
    const facet = await hre.deployments.get(name);
    return facet.address;
}

function genTokenIds(startDate, endDate, type) {
    start = time.toEpoch(new Date(startDate));
    end = time.toEpoch(new Date(endDate)) + 86400;
    return token.genTokenIds(start, end, type)
}

async function cloneWrapped(coin) {
    const { admin } = await hre.ethers.getNamedSigners();
    const wrappedConfig = hre.localConfig.wrapped[coin];
    const fallback = await common.getDeployment(hre, 'ERC20Facet');
    const initArgs = [
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
        await diamond.genInterfaces(
            hre,
            [
                '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20',
                '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            ]
        )
    ];
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
    const initArgs = [
        admin.address,
        fallback.address,
        ethers.utils.defaultAbiCoder.encode(
            ["address", "uint8", "address", "string"],
            [custodian.address, 100, rewardToken, uri]
        ),
        await diamond.genInterfaces(
            hre,
            ['IERC1155Rewardable', 'IERC1155', 'IERC1155Metadata']
        )
    ];
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
        await hre.deployments.fixture(['DeMineDev']);
        nft = await cloneNFT(coin);
    });

    it("TokenId", async function() {
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        var tokenIds = genTokenIds('2022-02-02', '2022-02-05', 'daily');
        expect(tokenIds.length).to.equal(4);

        tokenIds = genTokenIds('2022-02-05', '2022-02-18', 'weekly');
        expect(tokenIds.length).to.equal(2);
        tokenIds = genTokenIds('2022-02-05', '2022-02-17', 'weekly');
        expect(tokenIds.length).to.equal(1);

        tokenIds = genTokenIds('2022-02-11', '2022-03-09', 'biweekly');
        expect(tokenIds.length).to.equal(1);
        tokenIds = genTokenIds('2022-02-11', '2022-03-10', 'biweekly');
        expect(tokenIds.length).to.equal(2);
    });

    it("DiamondAdmin", async function () {
        const { deployer, admin, custodian } = await hre.ethers.getNamedSigners();
        const main = await hre.ethers.getContractAt('Diamond', nft);
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);

        //set fallback address
        const fallback = await common.getDeployment(hre, 'ERC1155Facet');
        await expect(
            await main.connect(custodian).getFallbackAddress()
        ).to.equal(fallback.address);

        // Pausable
        expect(await main.paused()).to.be.false;
        await expect(
            main.connect(custodian).pause()
        ).to.be.revertedWith('Ownable: sender must be owner');
        await main.connect(admin).pause();
        expect(await main.paused()).to.be.true;

        // mint not paused
        var tokenIds = genTokenIds('2022-02-12', '2022-02-13', 'daily')
        var encoded = token.encode(ethers, tokenIds);
        await expect(
            erc1155.connect(custodian).mintBatch(
                custodian.address, encoded, [50, 50], []
            )
        ).to.be.revertedWith('Ownable: sender must be owner');
        await erc1155.connect(admin).mintBatch(
            custodian.address, encoded, [50, 50], []
        );

        // normal transfer not paused
        await erc1155.connect(
            custodian
        ).safeBatchTransferFrom(
            custodian.address, admin.address, encoded, [49, 49], []
        );

        // transfer to alchemist paused
        await erc1155.connect(admin).finalize(tokenIds[1].endTs, 0),
        await expect(
            erc1155.connect(
                custodian
            ).safeBatchTransferFrom(
                custodian.address,
                await erc1155.alchemist(),
                encoded,
                [50, 50],
                []
            )
        ).to.be.revertedWith("Pausable: paused");

        await main.connect(admin).unpause();
        expect(await main.paused()).to.be.false;

        // SafeOwnable
        expect(await main.owner()).to.equal(admin.address);
        await main.connect(admin).transferOwnership(deployer.address);
        expect(await main.nomineeOwner()).to.equal(deployer.address);
        await main.connect(deployer).acceptOwnership();
        expect(await main.owner()).to.equal(deployer.address);
    });

    it("Diamond", async function () {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const contract = await hre.ethers.getContractAt('IDiamondCuttable', nft);

        // IDiamondCuttable
        const erc20 = await common.getDeployment(hre, 'ERC20Facet');
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
            contract.connect(custodian).diamondCut(
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
        await expect(
            facet.connect(custodian).setURI(newBaseUri)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).setURI(newBaseUri);
        expect(await facet.uri(1)).to.equal(newBaseUri + '1');
    });

    it('IERC165', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const base = await hre.ethers.getContractAt('Diamond', nft);

        expect(
            await base.supportsInterface(
                await diamond.genInterface(hre, 'IERC1155')
            )
        ).to.be.true;

        expect(
            await base.supportsInterface(
                await diamond.genInterface(hre, 'IERC1155Rewardable')
            )
        ).to.be.true;

        const iface = await diamond.genInterface(
            hre,
            '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20'
        );

        expect(await base.supportsInterface(iface)).to.be.false;
        await expect(
            base.connect(custodian).setSupportedInterface(iface, true)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await base.connect(admin).setSupportedInterface(iface, true);

        expect(await base.supportsInterface(iface)).to.be.true;
    });

    it('IERC2981', async function() {
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const facet = await hre.ethers.getContractAt('ERC1155Facet', nft);

        common.compareArray(await facet.royaltyInfo(1, 1000), [custodian.address, 10]);
        await expect(
            facet.connect(custodian).setRoyaltyInfo(admin.address, 1000)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).setRoyaltyInfo(admin.address, 1000);
        common.compareArray(await facet.royaltyInfo(1, 1000), [admin.address, 100]);
    });

    it('Mining', async function() {
        // setup
        const { admin, custodian } = await hre.ethers.getNamedSigners();
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const incomeAddr = await erc1155.earningToken();
        expect(incomeAddr).to.be.not.equal(address0);
        const income = await hre.ethers.getContractAt('ERC20Facet', incomeAddr);
        await income.connect(admin).mint(custodian.address, 10000000);
        await income.connect(custodian).approve(nft, 10000000);

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
        await erc1155.connect(admin).mintBatch(
            custodian.address, token.encode(ethers, daily), dailyAmounts, []
        );

        const weekly = genTokenIds('2022-02-02', '2022-12-02', 'weekly');
        const weeks = function(start, end) {
            return Math.floor(
                (
                    new Date(end).getTime() + 86400000- new Date(start).getTime()
                ) / (86400000 * 7)
            );
        };
        expect(weekly.length).to.equal(weeks('2022-02-02', '2022-12-02'));
        const weeklyAmounts = Array(weekly.length).fill(200);
        await erc1155.connect(admin).mintBatch(
            custodian.address, token.encode(ethers, weekly), weeklyAmounts, []
        );

        const biweekly = genTokenIds('2022-02-02', '2022-12-02', 'biweekly');
        const biweeks = function(start, end) {
            return Math.floor(
                (
                    new Date(end).getTime() + 86400000- new Date(start).getTime()
                ) / (86400000 * 7 * 2)
            );
        };
        expect(biweekly.length).to.equal(biweeks('2022-02-02', '2022-12-02'));
        const biweeklyAmounts = Array(biweekly.length).fill(300);
        await erc1155.connect(admin).mintBatch(
            custodian.address, token.encode(ethers, biweekly), biweeklyAmounts, []
        );

        // finalize
        const finalize = async function(date, reward) {
            await income.connect(custodian).transfer(nft, 600 * reward);
            var finalized = time.toEpoch(new Date(date));
            checkEvent(
                await erc1155.connect(admin).finalize(finalized, reward),
                nft,
                'Finalize',
                [finalized, reward]
            );
            expect(await erc1155.finalized()).to.equal(finalized);
        };

        await expect(
            erc1155.connect(admin).finalize(
                time.toEpoch(new Date('2022-02-02T12:00:00Z')),
                1
            )
        ).to.be.revertedWith('DeMineNFT: invalid timestamp')

        const earning = async function(id) {
            return await erc1155.earning(token.encodeOne(ethers, id));
        }
        await finalize('2022-02-03', 1);
        expect(await earning(daily[0])).to.equal(1);
        expect(await earning(weekly[0])).to.equal(1);
        expect(await earning(biweekly[0])).to.equal(1);
        await expect(
            erc1155.connect(admin).finalize(
                time.toEpoch(new Date('2022-02-02')), 1
            )
        ).to.be.revertedWith('DeMineNFT: invalid timestamp')

        await finalize('2022-02-09', 2);
        expect(await earning(daily[0])).to.equal(1);
        expect(await earning(daily[6])).to.equal(2);
        expect(await earning(weekly[0])).to.equal(3);
        expect(await earning(weekly[1])).to.equal(0);
        expect(await earning(biweekly[0])).to.equal(3);

        await finalize('2022-02-10', 3);
        expect(await earning(daily[6])).to.equal(2);
        expect(await earning(daily[7])).to.equal(3);
        expect(await earning(weekly[0])).to.equal(3);
        expect(await earning(weekly[1])).to.equal(3);
        expect(await earning(biweekly[0])).to.equal(6);

        await finalize('2022-02-16', 4);
        expect(await earning(daily[7])).to.equal(3);
        expect(await earning(daily[13])).to.equal(4);
        expect(await earning(weekly[1])).to.equal(7);
        expect(await earning(weekly[2])).to.equal(0);
        expect(await earning(biweekly[0])).to.equal(10);
        expect(await earning(biweekly[1])).to.equal(0);

        await finalize('2022-02-17', 5);
        expect(await earning(daily[13])).to.equal(4);
        expect(await earning(daily[14])).to.equal(5);
        expect(await earning(weekly[1])).to.equal(7);
        expect(await earning(weekly[2])).to.equal(5);
        expect(await earning(biweekly[0])).to.equal(10);
        expect(await earning(biweekly[1])).to.equal(5);

        // alchemize
        const alchemist = await erc1155.alchemist();
        await expect(
            erc1155.connect(custodian).safeBatchTransferFrom(
                custodian.address,
                alchemist,
                token.encode(ethers, daily.slice(13, 16)),
                [1, 1, 1],
                []
            )
        ).to.be.revertedWith('DeMineNFT: token not finalized yet')

        const signer = new ethers.Wallet(
            "0x65789150d0cb0485988f6488122eae027af2a116e202c65bff207d2b605b57cb",
            ethers.provider
        );
        await admin.sendTransaction(
            {to: signer.address, value: ethers.utils.parseEther("1.0")}
        );
        expect(alchemist, signer.address);
        await expect(
            erc1155.connect(signer).safeTransferFrom(
                alchemist, admin.address, [1, 2], [100, 200], []
            )
        ).to.be.revertedWith('DeMineNFT: from alchemist');

        checkEvent(
            await erc1155.connect(custodian).safeBatchTransferFrom(
                custodian.address,
                alchemist,
                [
                    token.encodeOne(ethers, daily[13]),
                    token.encodeOne(ethers, daily[14]),
                    token.encodeOne(ethers, weekly[0]),
                    token.encodeOne(ethers, weekly[1]),
                    token.encodeOne(ethers, biweekly[0])
                ],
                [100, 100, 100, 100, 100],
                []
            ),
            nft,
            'Alchemy',
            [custodian.address, 2900]
        );
        const balanceOf = async function(address, id) {
            return await erc1155.balanceOf(address, token.encodeOne(ethers, id));
        };
        expect(await income.balanceOf(nft)).to.equal(6100);
        expect(await balanceOf(custodian.address, daily[13])).to.equal(0);
        expect(await balanceOf(custodian.address, daily[14])).to.equal(0);
        expect(await balanceOf(custodian.address, weekly[0])).to.equal(100);
        expect(await balanceOf(custodian.address, weekly[1])).to.equal(100);
        expect(await balanceOf(custodian.address, biweekly[0])).to.equal(200);
    });
});

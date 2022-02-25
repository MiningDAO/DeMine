const { expect } = require("chai");
const hre = require("hardhat");
const BN = require("bignumber.js");
const utils = require("../lib/utils.js");
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const diamond = require("../lib/diamond.js");
const config = require("../lib/config.js");
const address0 = hre.ethers.constants.AddressZero;

const { logger } = require('../lib/logger.js');
const transport = logger.transports.find(
    t => t.name == 'console'
);
transport.level = 'warn';

function genTokenIds(startDate, endDate, type) {
    start = time.toEpoch(new Date(startDate));
    end = time.toEpoch(new Date(endDate)) + 86400;
    return token.genTokenIds(start, end, type)
}

describe("DeMineNFT", function () {
    const coin = 'btc';
    const tokenCostDecimal = '0.07644';
    const tokenIdsStruct = genTokenIds(
        '2022-02-03T00:00:00Z',
        '2022-04-03T00:00:00Z',
        'weekly'
    );
    const tokenIds = token.encode(tokenIdsStruct);
    var tokenCost, paymentTokenDecimals;
    var pricingStatic, paymentToken;
    var agent, admin, deployer, test;

    beforeEach(async function() {
        // set up account
        const signers = await hre.ethers.getNamedSigners();
        admin = signers.admin;
        deployer = signers.deployer;
        test = signers.test;

        // deploy
        await hre.deployments.fixture(['NFT', 'Agent', 'Mock']);
        pricingStatic = await config.getDeployment(hre, 'PricingStatic');
        pricingLinearDecay = await config.getDeployment(hre, 'PricingLinearDecay');

        // clone agent
        agent = await hre.run('agent-clone', {coin: coin, cost: tokenCostDecimal});
        const mortgage = await ethers.getContractAt('MortgageFacet', agent);
        paymentToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            await mortgage.paymentToken()
        );
        paymentTokenDecimals = await paymentToken.decimals();
        tokenCost = ethers.BigNumber.from(
            new BN(10).pow(paymentTokenDecimals).times(tokenCostDecimal).toFixed()
        );

        const nft = await mortgage.nft();
        await hre.run('nft-admin-custody', {coin: coin, nft: nft});
        const erc1155 = await hre.ethers.getContractAt('ERC1155Facet', nft);
        const custodian = await erc1155.custodian();

        // mint
        const mintAmounts = Array(tokenIds.length).fill(10000);
        await erc1155.connect(admin).mint(tokenIds, mintAmounts, []);

        // release to agent for deployer
        const releaseAmounts = Array(tokenIds.length).fill(1000);
        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [deployer.address])
        );

        // release to agent for test user
        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [test.address])
        );
    });

    it("royaltyInfo", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);

        const base = ethers.BigNumber.from(
            new BN(10).pow(paymentTokenDecimals).toFixed()
        );
        expect(await facet.royaltyInfo(10)).to.equal(0);
        expect(await facet.royaltyInfo(1000)).to.equal(10);
        expect(await facet.royaltyInfo(base.mul(10000))).to.equal(base.mul(100));
        expect(await facet.royaltyInfo(base.mul(11000))).to.equal(base.mul(100));

        await expect(
            facet.connect(deployer).setRoyaltyInfo(1, base.mul(10))
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).setRoyaltyInfo(1, base.mul(10));

        expect(await facet.royaltyInfo(1000)).to.equal(0);
        expect(await facet.royaltyInfo(10000)).to.equal(1);
        expect(await facet.royaltyInfo(base.mul(100000))).to.equal(base.mul(10));
        expect(await facet.royaltyInfo(base.mul(110000))).to.equal(base.mul(10));
    });
});

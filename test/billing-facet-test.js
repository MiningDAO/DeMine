const { expect } = require("chai");
const { ethers } = hre = require("hardhat");
const BN = require("bignumber.js");
const utils = require("../lib/utils.js");
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const diamond = require("../lib/diamond.js");
const config = require("../lib/config.js");
const address0 = ethers.constants.AddressZero;

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
    var tokenCost, paymentTokenDecimals, releaseAmounts;
    var pricingStatic, paymentToken, swapRouter, chainlink;
    var agent, erc1155, custodian, admin, deployer, test;

    beforeEach(async function() {
        // set up account
        const signers = await ethers.getNamedSigners();
        admin = signers.admin;
        deployer = signers.deployer;
        test = signers.test;

        swapRouter = await config.getDeployment('SwapRouterV2Mock');
        chainlink = await config.getDeployment('ChainlinkMock');

        // deploy
        await hre.deployments.fixture(['NFT', 'Agent', 'Mock']);
        pricingStatic = await config.getDeployment(hre, 'PricingStatic');
        pricingLinearDecay = await config.getDeployment(hre, 'PricingLinearDecay');

        // clone agent
        agent = await hre.run('agent-clone', {coin: coin, cost: tokenCostDecimal});
        const mortgage = await ethers.getContractAt('MortgageFacet', agent);
        paymentToken = await ethers.getContractAt(
            'ERC20Facet',
            await mortgage.paymentToken()
        );
        paymentTokenDecimals = await paymentToken.decimals();
        tokenCost = ethers.BigNumber.from(
            new BN(10).pow(paymentTokenDecimals).times(tokenCostDecimal).toFixed()
        );

        const nft = await mortgage.nft();
        erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
        custodian = await mortgage.custodian();
        await hre.run('nft-admin-custody', {coin: coin, nft: nft});
        const nftCustodian = await erc1155.custodian();

        // mint
        const mintAmounts = Array(tokenIds.length).fill(10000);
        await erc1155.connect(admin).mint(tokenIds, mintAmounts, []);

        // release to agent for deployer
        releaseAmounts = Array(tokenIds.length).fill(ethers.BigNumber.from(1000));
        await erc1155.connect(admin).safeBatchTransferFrom(
            nftCustodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [deployer.address])
        );
    });

    it("earningTokenDiscount", async function() {
        const facet = await ethers.getContractAt('BillingFacet', agent);

        expect(await facet.earningTokenDiscountInfo(10000)).to.equal(9000);
        await expect(
            facet.connect(test).setEarningTokenDiscountInfo(1000)
        ).to.be.revertedWith('Ownable: sender must be owner');

        await facet.connect(admin).setEarningTokenDiscountInfo(1000)
        expect(await facet.earningTokenDiscountInfo(10000)).to.equal(1000);

        await facet.connect(admin).setEarningTokenDiscountInfo(0)
        expect(await facet.earningTokenDiscountInfo(10000)).to.equal(0);

        await facet.connect(admin).setEarningTokenDiscountInfo(65535)
        expect(await facet.earningTokenDiscountInfo(10000)).to.equal(10000);
    });

    it("tryBilling", async function() {
        const facet = await ethers.getContractAt('BillingFacet', agent);
        const mortgageFacet = await ethers.getContractAt('MortgageFacet', agent);

        await expect(
            facet.connect(test).tryBilling(0)
        ).to.be.revertedWith('Ownable: sender must be owner');

        // no balance
        await facet.connect(admin).tryBilling(0);
        var [statement] = await mortgageFacet.billingStatementOfBatch([0]);
        expect(statement.balance).to.equal(0);
        expect(statement.surplus).to.equal(0);
        expect(statement.debt).to.equal(0);

        // no earning
        await facet.connect(admin).tryBilling(tokenIds[0]);
        [statement] = await mortgageFacet.billingStatementOfBatch([tokenIds[0]]);
        expect(statement.balance).to.equal(1000);
        expect(statement.surplus).to.equal(0);
        expect(statement.debt).to.equal(tokenCost.mul(1000));

        // set earning
        const finalize = async (toFinalize) => {
            const earningToken = await erc1155.earningToken();
            const earningPerToken = 4433668779503;
            const totalEarning = earningPerToken * 1000;
            await earningToken.connect(admin).mint(admin.address, totalEarning);
            await earningToken.connect(admin).approve(erc1155.address, totalEarning);
            await erc1155.finalize(
                toFinalize,
                earning,
                admin.address,
                totalEarning
            );
        };
        await finalize(tokenIdsStruct[0].endTs);

        // swap failed
        await swapRouter.setFail(true);
        await facet.connect(admin).tryBilling(tokenIds[0]);
        [statement] = await mortgageFacet.billingStatementOfBatch([tokenIds[0]]);
        expect(statement.balance).to.equal(1000);
        expect(statement.surplus).to.equal(0);
        expect(statement.debt).to.equal(tokenCost.mul(1000));
    });
});

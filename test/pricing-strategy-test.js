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
    var pricingStatic, pricingLinearDecay;
    var tokenCost;
    var agent, paymentToken, paymentTokenDecimals, admin, deployer, test;

    beforeEach(async function() {
        // set up account
        const signers = await hre.ethers.getNamedSigners();
        admin = signers.admin;
        deployer = signers.deployer;
        test = signers.test;

        // deploy
        await hre.deployments.fixture(['NFT', 'Agent', 'Local']);
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

        // release to agent
        const releaseAmounts = Array(tokenIds.length).fill(1000);
        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [deployer.address])
        );

        await erc1155.connect(admin).safeBatchTransferFrom(
            custodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [test.address])
        );
    });

    it("PricingStrategyRegistry", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        expect(
            await facet.isRegisteredPricingStrategy(pricingStatic.address)
        ).equal(true);
        expect(
            await facet.isRegisteredPricingStrategy(pricingLinearDecay.address)
        ).equal(true);

        await expect(
            facet.connect(deployer).setPricingStrategy(agent)
        ).to.be.revertedWith('Mining3Agent: pricing strategy not registered');

        await expect(
            facet.connect(test).registerPricingStrategy(agent)
        ).to.be.revertedWith('Ownable: sender must be owner');
        await facet.connect(admin).registerPricingStrategy(agent);
        expect(await facet.isRegisteredPricingStrategy(agent)).equal(true);

        await facet.connect(deployer).setPricingStrategy(agent);
        expect(await facet.pricingStrategy(deployer.address)).to.equal(agent);
    });

    it("PricingStatic", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await facet.connect(deployer).setPricingStrategy(pricingStatic.address);

        await expect(
            pricingStatic.connect(deployer).setPrice(
                0,
                [1],
                [1, 2]
            )
        ).to.be.revertedWith(
            'PricingStatic: array length mismatch'
        );

        const baseDelta = new BN(10).pow(paymentTokenDecimals).times(0.05).toFixed();
        const basePrice1 = tokenCost.add(baseDelta);
        const ids = tokenIds.slice(0, 6);
        const overrideDelta = new BN(10).pow(paymentTokenDecimals).times(0.01).toFixed();
        const overrides = Array(ids.length / 2).fill(tokenCost.sub(overrideDelta)).concat(
            Array(ids.length / 2).fill(tokenCost.add(overrideDelta))
        );
        await pricingStatic.connect(deployer).setPrice(
            basePrice1, ids, overrides
        );
        const prices1 = await pricingStatic.priceOfBatch(
            deployer.address, tokenCost, tokenIds
        );
        for (let i = 0; i < tokenIds.lenght; i++) {
            if (i < ids.length / 2) {
                expect(prices1[i]).to.equal(tokenCost);
            } else if (i < ids.length) {
                expect(prices1[i]).to.equal(overrides[i]);
            } else {
                expect(prices1[i]).to.equal(basePrice1);
            }
        }

        const basePrice2 = tokenCost.sub(baseDelta);
        await pricingStatic.connect(deployer).setPrice(
            basePrice2, [], []
        );
        const prices2 = await pricingStatic.priceOfBatch(
            deployer.address, tokenCost, tokenIds
        );
        for (let i = 0; i < tokenIds.lenght; i++) {
            if (i < ids.length) {
                expect(prices2[i]).to.equal(tokenCost);
            }
        }
    });

    it("PricingLinearDecay", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await facet.connect(deployer).setPricingStrategy(pricingLinearDecay.address);

        const delta = new BN(10).pow(paymentTokenDecimals).times(0.05).toFixed();
        const maxPrice = tokenCost.add(delta);
        const anchor = time.toEpoch(new Date('2022-02-10T00:00:00Z'));
        const slope = ethers.BigNumber.from('10000000');
        const slopeBase = 3;
        await pricingLinearDecay.connect(deployer).setPrice(
            [maxPrice, anchor, slope, slopeBase]
        );

        const prices = await pricingLinearDecay.priceOfBatch(
            deployer.address, tokenCost, tokenIds
        );
        var turningPoint = maxPrice.div(tokenCost).mul(slope).div(slopeBase) + anchor;
        for (let i = 0; i < tokenIds.lenght; i++) {
            const id = tokenIdsStruct[i];
            const middle = (id.startTs + id.endTs) / 2;
            if (middle <= anchor) {
                expect(prices[i]).to.equal(maxPrice);
            } else if (middle < turningPoint) {
                expect(prices[i]).to.equal(
                    maxPrice.sub(slope.mul(middle - anchor).div(slopeBase))
                );
            } else {
                expect(prices[i]).to.equal(tokenCost);
            }
        }
    });
});

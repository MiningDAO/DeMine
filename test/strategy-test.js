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
const console = logger.transports.find(
    t => t.name == 'console'
);
console.level = 'warn';

function genTokenIds(startDate, endDate, type) {
    start = time.toEpoch(new Date(startDate));
    end = time.toEpoch(new Date(endDate)) + 86400;
    return token.genTokenIds(start, end, type)
}

describe("DeMineNFT", function () {
    const coin = 'btc';
    const tokenCost = '0.07644';
    const tokenIdsStruct = genTokenIds(
        '2022-02-03T00:00:00Z',
        '2022-04-03T00:00:00Z',
        'weekly'
    );
    const tokenIds = token.encode(tokenIdsStruct);
    var pricingStatic, pricingLinearDecay, allowanceFixedOneTime, allowanceRangeOneTime;
    var agent, paymentToken, paymentTokenDecimals, admin, deployer, test;

    beforeEach(async function() {
        // set up account
        const signers = await hre.ethers.getNamedSigners();
        admin = signers.admin;
        deployer = signers.deployer;
        test = signers.test;

        // deploy
        await hre.deployments.fixture(['NFT', 'Agent', 'Mock']);
        pricingStatic = await config.getDeployment(hre, 'PricingStatic');
        pricingStatic = pricingStatic.address;
        pricingLinearDecay = await config.getDeployment(hre, 'PricingLinearDecay');
        pricingLinearDecay = pricingLinearDecay.address;
        allowanceFixedOneTime = await config.getDeployment(hre, 'AllowanceFixedOneTime');
        allowanceFixedOneTime = allowanceFixedOneTime.address;
        allowanceRangeOneTime = await config.getDeployment(hre, 'AllowanceRangeOneTime');
        allowanceRangeOneTime = allowanceRangeOneTime.address;

        // clone agent
        agent = await hre.run('agent-clone', {coin: coin, cost: tokenCost});
        const mortgage = await ethers.getContractAt('MortgageFacet', agent);
        paymentToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            await mortgage.paymentToken()
        );
        paymentTokenDecimals = await paymentToken.decimals();

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

    it("StrategyRegistry", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        expect(await facet.registeredStrategyType(pricingStatic)).equal(1);
        expect(await facet.registeredStrategyType(pricingLinearDecay)).equal(1);
        expect(await facet.registeredStrategyType(allowanceFixedOneTime)).equal(2);
        expect(await facet.registeredStrategyType(allowanceRangeOneTime)).equal(2);

        await expect(
            facet.connect(test).registerStrategy(pricingStatic, 0)
        ).to.be.revertedWith('Ownable: sender must be owner');

        await facet.connect(admin).registerStrategy(pricingStatic, 0);
        expect(await facet.registeredStrategyType(pricingStatic)).equal(0);
    });

    it("StrategySet", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await facet.connect(deployer).setStrategy(pricingStatic);
        expect(await facet.getStrategy(1)).equal(pricingStatic);

        await facet.connect(deployer).setStrategy(pricingLinearDecay);
        expect(await facet.getStrategy(1)).equal(pricingLinearDecay);

        await facet.connect(deployer).setStrategy(allowanceFixedOneTime);
        expect(await facet.getStrategy(2)).equal(allowanceFixedOneTime);

        await facet.connect(deployer).setStrategy(allowanceRangeOneTime);
        expect(await facet.getStrategy(2)).equal(allowanceRangeOneTime);

        await facet.connect(admin).registerStrategy(pricingStatic, 0);
        await expect(
            facet.connect(deployer).setStrategy(pricingStatic)
        ).to.be.revertedWith('Mining3Agent: strategy not registered');

        await facet.connect(admin).registerStrategy(allowanceFixedOneTime, 0);
        await expect(
            facet.connect(deployer).setStrategy(allowanceFixedOneTime)
        ).to.be.revertedWith('Mining3Agent: strategy not registered');
    });

    it("PricingStatic", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);

        await expect(
            facet.connect(deployer).setPricing([])
        ).to.be.revertedWith('Mining3Agent: pricing strategy not set');
        await facet.connect(deployer).setStrategy(pricingStatic);
        const base = new BN(10).pow(paymentTokenDecimals);

        const ids = tokenIds.slice(0, 5);
        const validBasePrice = ethers.BigNumber.from(base.times(0.2).toFixed());
        const validOverrides = Array(ids.length).fill(validBasePrice.mul(2));
        const invalidBasePrice = ethers.BigNumber.from(base.times(0.06).toFixed());

        await expect(
            facet.connect(deployer).setPricing(
                ethers.utils.defaultAbiCoder.encode(
                    ['uint', 'uint[]', 'uint[]'],
                    [invalidBasePrice, ids, validOverrides]
                )
            )
        ).to.be.revertedWith(
            'PricingStatic: base price smaller than token cost'
        );

        const invalidOverrides = Array(ids.length).fill(invalidBasePrice);
        await expect(
            facet.connect(deployer).setPricing(
                ethers.utils.defaultAbiCoder.encode(
                    ['uint', 'uint[]', 'uint[]'],
                    [validBasePrice, ids, invalidOverrides]
                )
            )
        ).to.be.revertedWith(
            'PricingStatic: override price smaller than token cost'
        );

        await expect(
            facet.connect(deployer).setPricing(
                ethers.utils.defaultAbiCoder.encode(
                    ['uint', 'uint[]', 'uint[]'],
                    [validBasePrice, ids.slice(0, 4), validOverrides]
                )
            )
        ).to.be.revertedWith(
            'PricingStatic: array length mismatch'
        );

        await facet.connect(deployer).setPricing(
            ethers.utils.defaultAbiCoder.encode(
                ['uint', 'uint[]', 'uint[]'],
                [validBasePrice, ids, validOverrides]
            )
        );

        var prices = await facet.priceOfBatch(deployer.address, tokenIds);
        for (let i = 0; i < tokenIds.lenght; i++) {
            if (i < ids.length) {
                expect(prices[i]).to.equal(validOverrides[i]);
            } else {
                expect(prices[i]).to.equal(validBasePrice);
            }
        }
    });

    it.only("PricingLinearDecay", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await expect(
            facet.connect(deployer).setPricing([])
        ).to.be.revertedWith('Mining3Agent: pricing strategy not set');
        await facet.connect(deployer).setStrategy(pricingLinearDecay);

        const base = new BN(10).pow(paymentTokenDecimals);
        const maxPrice = ethers.BigNumber.from(base.times(0.2).toFixed());
        const validMinPrice = ethers.BigNumber.from(base.times(0.1).toFixed());
        const anchor = time.toEpoch(new Date('2022-02-10T00:00:00Z'));
        const slope = ethers.BigNumber.from('10000000');
        const slopeBase = 3;

        // larger than max price
        var invalidMinPrice = ethers.BigNumber.from(base.times(0.3).toFixed());
        await expect(
            facet.connect(deployer).setPricing(
                ethers.utils.defaultAbiCoder.encode(
                    ['uint', 'uint', 'uint128', 'uint64', 'uint64'],
                    [maxPrice, invalidMinPrice, anchor, slope, slopeBase]
                )
            )
        ).to.be.revertedWith(
            'PricingLinearDecay: invalid max or min price'
        );

        // smaller than token cost
        invalidMinPrice = ethers.BigNumber.from(base.times(0.05).toFixed());
        await expect(
            facet.connect(deployer).setPricing(
                ethers.utils.defaultAbiCoder.encode(
                    ['uint', 'uint', 'uint128', 'uint64', 'uint64'],
                    [maxPrice, invalidMinPrice, anchor, slope, slopeBase]
                )
            )
        ).to.be.revertedWith(
            'PricingLinearDecay: invalid max or min price'
        );

        await facet.connect(deployer).setPricing(
            ethers.utils.defaultAbiCoder.encode(
                ['uint', 'uint', 'uint128', 'uint64', 'uint64'],
                [maxPrice, validMinPrice, anchor, slope, slopeBase]
            )
        );

        var prices = await facet.priceOfBatch(deployer.address, tokenIds);
        var turningPoint = maxPrice.div(validMinPrice).mul(slope).div(slopeBase) + anchor;
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
                expect(prices[i]).to.equal(validMinPrice);
            }
        }
    });

    it("AllowanceFixedOneTime", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await expect(
            facet.connect(deployer).setAllowance(test.address, [])
        ).to.be.revertedWith('Mining3Agent: allowance strategy not set');
        await facet.connect(deployer).setStrategy(allowanceFixedOneTime);

        const allowance = 1000;
        await facet.connect(deployer).setAllowance(
            test.address,
            ethers.utils.defaultAbiCoder.encode(['uint'], [allowance])
        );

        var allowances = await facet.allowanceOfBatch(
            deployer.address,
            test.address,
            tokenIds,
        );
        for (let i = 0; i < tokenIds.lenght; i++) {
            expect(allowances[i]).to.equal(allowance);
        };
    });

    it("AllowanceRangeOneTime", async function() {
        const facet = await hre.ethers.getContractAt('PrimaryMarketFacet', agent);
        await expect(
            facet.connect(deployer).setAllowance(test.address, [])
        ).to.be.revertedWith('Mining3Agent: allowance strategy not set');
        await facet.connect(deployer).setStrategy(allowanceRangeOneTime);

        const start = time.toEpoch(new Date('2022-02-17T00:00:00Z'));
        const end = time.toEpoch(new Date('2022-03-15T00:00:00Z'));
        const allowance = 1000;
        await facet.connect(deployer).setAllowance(
            test.address,
            ethers.utils.defaultAbiCoder.encode(
                ['uint128', 'uint128', 'uint'],
                [start, end, allowance]
            )
        );

        var allowances = await facet.allowanceOfBatch(
            deployer.address,
            test.address,
            tokenIds,
        );
        for (let i = 0; i < tokenIds.lenght; i++) {
            const id = tokenIdsStruct[i];
            if (id.startTs >= start && id.endTs <= end) {
                expect(allowances[i]).to.equal(allowance);
            } else {
                expect(allowances[i]).to.equal(0);
            }
        };
    });
});

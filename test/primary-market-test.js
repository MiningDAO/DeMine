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
    var pricingStatic, paymentToken;
    var agent, nft, custodian, admin, deployer, test;

    beforeEach(async function() {
        // set up account
        const signers = await ethers.getNamedSigners();
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
            'ERC20Facet',
            await mortgage.paymentToken()
        );
        paymentTokenDecimals = await paymentToken.decimals();
        tokenCost = ethers.BigNumber.from(
            new BN(10).pow(paymentTokenDecimals).times(tokenCostDecimal).toFixed()
        );

        nft = await mortgage.nft();
        custodian = await mortgage.custodian();
        await hre.run('nft-admin-custody', {coin: coin, nft: nft});
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
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

        // release to agent for test user
        await erc1155.connect(admin).safeBatchTransferFrom(
            nftCustodian,
            agent,
            tokenIds,
            releaseAmounts,
            ethers.utils.defaultAbiCoder.encode(['address'], [test.address])
        );
    });

    it("royaltyInfo", async function() {
        const facet = await ethers.getContractAt('PrimaryMarketFacet', agent);

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

    it("approve", async function() {
        const facet = await ethers.getContractAt('PrimaryMarketFacet', agent);
        expect(
            await facet.isApproved(deployer.address, test.address)
        ).to.be.false;

        await facet.connect(deployer).approve(test.address, true);
        expect(
            await facet.isApproved(deployer.address, test.address)
        ).to.be.true;

        await facet.connect(deployer).approve(test.address, false);
        expect(
            await facet.isApproved(deployer.address, test.address)
        ).to.be.false;

        await facet.connect(deployer).approve(ethers.constants.AddressZero, true);
        expect(
            await facet.isApproved(deployer.address, test.address)
        ).to.be.true;
    });

    it("claimFrom", async function() {
        const facet = await ethers.getContractAt('PrimaryMarketFacet', agent);

        // set price
        await facet.connect(deployer).setPricingStrategy(pricingLinearDecay.address);
        const maxPrice = tokenCost.add(
            new BN(10).pow(paymentTokenDecimals).times(0.13).toFixed()
        );
        const anchor = time.toEpoch(new Date('2022-02-10T00:00:00Z'));
        await pricingLinearDecay.connect(deployer).setPrice(
            [maxPrice, anchor, 10000000, 3]
        );

        // approve
        await facet.connect(deployer).approve(test.address, true);

        // claim
        await expect(
            facet.connect(test).claimFrom(deployer.address, [1], [])
        ).to.be.revertedWith('TokenLocker: array length mismatch');

        await expect(
            facet.connect(deployer).claimFrom(test.address, [], [])
        ).to.be.revertedWith('Mining3Agent: operator not approved');

        await expect(
            facet.connect(test).claimFrom(
                deployer.address, [tokenIds[0]], [1001]
            )
        ).to.be.revertedWith('Mining3Agent: insufficient balance');

        const amounts = releaseAmounts.map(r => r.div(2));

        const prices = await pricingLinearDecay.priceOfBatch(
            deployer.address, tokenCost, tokenIds
        );
        const expectedCost = Array(tokenIds.length).fill(0).reduce(
            (prev, _, i) => tokenCost.mul(amounts[i]).add(prev),
            0
        );
        const expectedEarned = Array(tokenIds.length).fill(0).reduce(
            (prev, _, i) => prices[i].sub(tokenCost).mul(amounts[i]).add(prev),
            0
        );
        const expectedRoyalty = await facet.royaltyInfo(expectedEarned);

        // setup payment token
        const balance = expectedEarned.add(expectedCost);
        await paymentToken.connect(admin).mint(test.address, balance);
        await paymentToken.connect(test).approve(agent, balance);

        const tx = await facet.connect(test).claimFrom(
            deployer.address, tokenIds, amounts
        );
        const {events} = receipt = await tx.wait();
        const checkERC20Transfer = (events, contract, from, to, value) => {
            expect(events.find(e =>
                e.address == contract &&
                e.topics.length == 3 &&
                ethers.BigNumber.from(e.topics[1]).eq(from) &&
                ethers.BigNumber.from(e.topics[2]).eq(to) &&
                ethers.BigNumber.from(e.data).eq(value)
            )).to.not.equal(undefined);
        };
        checkERC20Transfer(
            events,
            paymentToken.address,
            test.address,
            custodian,
            expectedCost.add(expectedRoyalty)
        );
        checkERC20Transfer(
            events,
            paymentToken.address,
            test.address,
            deployer.address,
            expectedEarned.sub(expectedRoyalty)
        );

        const transfer = events.find(e =>
            e.address == nft &&
            e.topics.length == 4 &&
            ethers.BigNumber.from(e.topics[1]).eq(agent) &&
            ethers.BigNumber.from(e.topics[2]).eq(agent) &&
            ethers.BigNumber.from(e.topics[3]).eq(test.address)
        );
        expect(transfer).to.not.equal(undefined);
        expect(transfer.data).to.equal(
            ethers.utils.defaultAbiCoder.encode(
                ['uint[]', 'uint[]'],
                [tokenIds, amounts]
            )
        );
    });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const utils = require("./demine-test-utils.js");
const config = require("../lib/config.js");
const logger = require('../lib/logger.js');
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const BN = require('bignumber.js');

describe("DeMine Agent", function () {
    const miningCoin = 'btc';
    const tokenCost = '100';
    let deployer, admin, tester, mortgageAgent, nftToken, nftCustodian, paymentCoin;

    beforeEach(async function() {
        const signers = await hre.ethers.getNamedSigners();
        deployer = signers.deployer;
        admin = signers.admin;
        tester = signers.test;
        await hre.deployments.fixture(['NFT', 'Agent']);
        mortgageAgentAddr = await hre.run('agent-clone', {
            coin: miningCoin,
            cost: tokenCost
        });
        mortgageAgent = await hre.ethers.getContractAt('MortgageFacet', mortgageAgentAddr);
        nftToken = await hre.ethers.getContractAt('ERC1155Facet', await mortgageAgent.nft());
        paymentCoin = await hre.ethers.getContractAt('ERC20Facet', await mortgageAgent.paymentToken());
    });

    it("Initialized", async function () {
        let normalizedTokenCost = new BN(10).pow(18).times(tokenCost).toFixed();
        expect(await mortgageAgent.tokenCost()).to.equal(normalizedTokenCost);
        expect(await mortgageAgent.custodian()).to.equal(admin.address);
        nftCustodian = await ethers.getContractAt(
            'ERC1155Custodian',
            await nftToken.custodian()
        );
        expect(await nftToken.custodian()).to.equal(nftCustodian.address);
    });

    it("onERC1155BatchReceivedSuccessfully", async function () {
        let tokenId1 = token.encodeOne(token.genTokenId(time.toEpoch(new Date('2022-02-03')), 'weekly'));
        let balance = await mortgageAgent.balanceOfBatch(tester.address, [tokenId1]);
        expect(balance["0"]).to.equal(BN(0).toFixed());

        let abiCoder = ethers.utils.defaultAbiCoder;
        let data = await abiCoder.encode(["address"], [tester.address]);
        await mortgageAgent.onERC1155BatchReceived(admin.address, nftToken.custodian(), [tokenId1], [BN(5).toFixed()], data);
        balance = await mortgageAgent.balanceOfBatch(tester.address, [tokenId1]);
        expect(balance["0"]).to.equal(BN(5).toFixed());

    });

    it("CannotRedeemInvalidInput", async function () {
        await expect(mortgageAgent.redeemNFT([BN(1).toFixed(), BN(2).toFixed()], [BN(3).toFixed()])
            ).to.be.revertedWith('DeMineAgent: array length mismatch');
    });

    it("CannotRedeemNotEnoughBalance", async function () {
        let tokenId1 = token.encodeOne(token.genTokenId(time.toEpoch(new Date('2022-02-03')), 'weekly'));
        await expect(mortgageAgent.connect(tester).redeemNFT([tokenId1], [BN(1).toFixed()])
            ).to.be.revertedWith('DeMineAgent: no sufficient balance');

        let abiCoder = ethers.utils.defaultAbiCoder;
        let data = await abiCoder.encode(["address"], [tester.address]);
        await mortgageAgent.onERC1155BatchReceived(admin.address, nftToken.custodian(), [tokenId1], [BN(2).toFixed()], data);
        await expect(mortgageAgent.connect(tester).redeemNFT([tokenId1], [BN(3).toFixed()])
            ).to.be.revertedWith('DeMineAgent: no sufficient balance');
    });

    it("CannotRedeemFailedPayment", async function () {
        let tokenId1 = token.encodeOne(token.genTokenId(time.toEpoch(new Date('2022-02-03')), 'weekly'));

        let abiCoder = ethers.utils.defaultAbiCoder;
        let data = await abiCoder.encode(["address"], [tester.address]);
        await mortgageAgent.onERC1155BatchReceived(admin.address, nftToken.custodian(), [tokenId1], [BN(5).toFixed()], data);
        await expect(mortgageAgent.connect(tester).redeemNFT([tokenId1], [BN(3).toFixed()])
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it("SuccessfulRedeem", async function () {
        let tokenId1 = token.encodeOne(token.genTokenId(time.toEpoch(new Date('2022-02-03')), 'weekly'));

        await hre.run('nft-admin-custody', {coin: miningCoin, nft: await mortgageAgent.nft()});
        await nftToken.connect(admin).mint([tokenId1], [BN(10).toFixed()], []);
        expect(await nftToken.balanceOf(await nftToken.custodian(), tokenId1)).to.equal(10);
        logger.info("########");
        logger.info(mortgageAgent.address);
        await nftToken.connect(admin).safeTransferFrom(
            await nftToken.custodian(),
            mortgageAgent.address,
            tokenId1,
            10,
            ethers.utils.defaultAbiCoder.encode(['address'], [tester.address])
        );
        expect(await nftToken.balanceOf(mortgageAgent.address, tokenId1)).to.equal(10);

/*
        let abiCoder = ethers.utils.defaultAbiCoder;
        let data = await abiCoder.encode(["address"], [tester.address]);
        await mortgageAgent.onERC1155BatchReceived(admin.address, nftToken.custodian(), [tokenId1], [BN(5).toFixed()], data);
        let balance = await mortgageAgent.balanceOfBatch(tester.address, [tokenId1]);
        expect(balance["0"]).to.equal(BN(5).toFixed());
      
        await paymentCoin.connect(admin).mint(tester.address, BN(5000).pow(18).toFixed());
        await paymentCoin.connect(tester).approve(mortgageAgent.address, BN(5000).pow(18).toFixed());
mortgageAgent.connect(tester).redeemNFT([tokenId1], [BN(3).toFixed()]);
        await expect(mortgageAgent.connect(tester).redeemNFT([tokenId1], [BN(3).toFixed()])
            ).to.not.be.reverted;

        balance = await mortgageAgent.balanceOfBatch(tester.address, [tokenId1]);
        expect(balance["0"]).to.equal(BN(2).toFixed());
                */
    });




        /*
        let { agent, payments: [p1, p2, _] } = contracts;
        let { admin, users: [user1, user2, _user3] } = signers;

        // setup
        let numCycles = 120;
        let pool = 1;
        let cycles = utils.range(10, 130);
        let supplies = Array(numCycles).fill(100);
        await nft.connect(admin).newPool(
            10, 120, supplies, 1000, 2000, user1.address
        );
        await utils.airdrop(p1, admin, user1, agent, 10000000000);
        await utils.airdrop(p1, admin, user2, agent, 10000000000);
        expect(await agent.paused()).to.be.false;
        const PausableError = "Pausable: paused";

        // pause
        await expect(
            agent.connect(user1).pause()
        ).to.be.revertedWith(OwnableError);

        await expect(
            agent.connect(admin).pause()
        ).to.emit(agent, "Paused").withArgs(admin.address);
        expect(await agent.paused()).to.be.true;

        await expect(
            agent.connect(user1).transferPool(1, user2.address)
        ).to.be.revertedWith(PausableError);

        await expect(
            agent.connect(user1).redeem(p1.address, pool, cycles, supplies)
        ).to.be.revertedWith(PausableError);

        let prices = Array(numCycles).fill(2000);
        await expect(
            agent.connect(user1).increaseAllowance(
                address0, pool, cycles, supplies
            )
        ).to.be.revertedWith(PausableError);

        await expect(
            agent.connect(user1).decreaseAllowance(
                address0, pool, cycles, supplies
            )
        ).to.be.revertedWith(PausableError);

        await expect(
            agent.connect(user2).claim(p1.address, pool, cycles, supplies)
        ).to.be.revertedWith(PausableError);

        await expect(
            agent.connect(user2).setPrices(pool, cycles, prices)
        ).to.be.revertedWith(PausableError);

        // unpause
        await expect(
            agent.connect(user1).unpause()
        ).to.be.revertedWith(OwnableError);

        await expect(
            agent.connect(admin).unpause()
        ).to.emit(agent, "Unpaused").withArgs(admin.address);
        expect(await agent.paused()).to.be.false;

        await expect(
            agent.connect(user1).setPrices(pool, cycles, prices)
        ).to.emit(agent, "PricesSet").withArgs(
            user1.address, pool, cycles, prices
        );

        let half = supplies.map(s => s / 2);
        await expect(
            agent.connect(user1).redeem(p1.address, pool, cycles, half)
        ).to.emit(agent, "Redeem").withArgs(
            user1.address, pool, p1.address
        );

        await expect(
            agent.connect(user1).increaseAllowance(
                address0, pool, cycles, supplies
            )
        ).to.emit(agent, "IncreaseAllowance").withArgs(
            user1.address, address0, pool, cycles, supplies
        );

        await expect(
            agent.connect(user1).decreaseAllowance(
                address0, pool, cycles, half
            )
        ).to.emit(agent, "DecreaseAllowance").withArgs(
            user1.address, address0, pool, cycles, half
        );

        await expect(
            agent.connect(user1).increaseAllowance(
                user2.address, pool, cycles, half
            )
        ).to.emit(agent, "IncreaseAllowance").withArgs(
            user1.address, user2.address, pool, cycles, half
        );

        let halfhalf = half.map(h => h / 2);
        await expect(
            agent.connect(user2).claim(p1.address, pool, cycles, halfhalf)
        ).to.emit(agent, "Claim").withArgs(
            user2.address, user2.address, pool, p1.address
        );

        await expect(
            agent.connect(user2).claimUnnamed(p1.address, pool, cycles, halfhalf)
        ).to.emit(agent, "Claim").withArgs(
            user2.address, address0, pool, p1.address
        );

        await expect(
            agent.connect(user1).transferPool(1, user2.address)
        ).to.emit(agent, "PoolTransfer").withArgs(
            1, user1.address, user2.address
        );
    });

    it("transfer pool", async function () {
        const [user1, user2, _] = signers.users;

        // pool 1 should be set
        let { ids, amounts } = await utils.mintAndRedeem(
            contracts, signers.admin, user1
        );
        let [owner, costPerToken] = await agent.poolInfo(1);
        expect(owner).to.equal(user1.address);
        expect(costPerToken).to.equal(1000);

        // transfer pool with nor owner
        await expect(
            agent.connect(user1).transferPool(1, address0)
        ).to.be.revertedWith(
            "DeMineAgent: new pool owner is zero address"
        );

        await expect(
            agent.connect(user2).transferPool(1, user2.address)
        ).to.be.revertedWith(
            "DeMineAgent: only pool owner allowed"
        );

        // transfer pool with owner
        await expect(
            agent.connect(user1).transferPool(1, user2.address)
        ).to.emit(agent, "PoolTransfer").withArgs(
            1, user1.address, user2.address
        );
    });

    it("set payment", async function () {
        let { admin, users: [user1, _] } = signers;
        let { payments: [p1, p2, p3] } = contracts;
        // get payment
        expect(await agent.isPaymentSupported(p1.address)).to.be.true;
        expect(await agent.isPaymentSupported(p2.address)).to.be.true;
        expect(await agent.isPaymentSupported(p3.address)).to.be.true;

        // set with non-owner, should fail
        await expect(
            agent.connect(user1).setPayment(p1.address, false)
        ).to.be.revertedWith(OwnableError);

        // set payment
        await expect(
            agent.connect(admin).setPayment(p1.address, false)
        ).to.emit(agent, "PaymentSet").withArgs(
            p1.address, false
        );
        expect(await agent.isPaymentSupported(p1.address)).to.be.false;
    });

    it("set reward token recipient", async function () {
        let { custodian } = signers;
        await expect(
            agent.connect(user1).setCustodian(user1.address)
        ).to.be.revertedWith(OwnableError);

        await expect(
            agent.connect(admin).setCustodian(user1.address)
        ).to.emit(agent, "CustodianSet").withArgs(
            custodian.address, user1.address
        );
    });

    it("set prices", async function () {
        let { admin, users: [user1, user2, _] } = signers;
        await utils.mintAndRedeem(contracts, admin, user1);

        let pool = 1;
        let cycles = utils.range(10, 60);
        let ids = cycles.map(c => utils.id(pool, c));
        utils.compareArray(await agent.prices(ids), Array(50).fill(2000));

        let prices = Array(50).fill(3000);
        await expect(
            agent.connect(user2).setPrices(pool, cycles, prices)
        ).to.be.revertedWith("DeMineAgent: only pool owner allowed");

        await expect(
            agent.connect(user1).setPrices(pool, cycles, Array(40).fill(2000))
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user1).setPrices(pool, cycles, Array(50).fill(500))
        ).to.be.revertedWith("DeMineAgent: price too low to cover cost");

        await expect(
            agent.connect(user1).setPrices(pool, cycles, prices)
        ).to.emit(agent, "PricesSet").withArgs(
            user1.address, pool, cycles, prices
        );
        utils.compareArray(await agent.prices(ids), prices);
    });

    it("ERC1155 Receiver", async function () {
        const { admin, users: [user1, user2, _u3] } = signers;
        const { nft, payments: [p1, _], agent } = contracts;
        let numCycles = 120;
        let ids = utils.ids(1, 10, numCycles);
        let supplies = Array(numCycles).fill(100);

        // create pool and receive tokens
        let half = supplies.map(s => s / 2);
        await expect(
            nft.connect(admin).newPool(
                10, 120, half, 1000, 2000, user1.address
            )
        ).to.emit(agent, "NewPool").withArgs(
            1, user1.address, 1000, 2000
        ).to.emit(nft, "TransferBatch").withArgs(
            admin.address, address0, agent.address, ids, half
        );
        await utils.checkBalances(agent, ids, half);

        await nft.connect(admin).expandPool(
            1, 10, 120, half
        );
        await utils.checkBalances(agent, ids, supplies);

        // redeem all to user
        await utils.airdrop(p1, admin, user1, agent, 100000000);
        await utils.redeem(agent, user1, p1, ids, supplies);
        await utils.checkBalances(agent, ids, Array(numCycles).fill(0));
        await utils.checkBalances(user1, ids, supplies);

        // should not receive tokens from custom user
        await expect(
            nft.connect(user1).safeTransferFrom(
                user1.address, agent.address, ids[0], supplies[0], []
            )
        ).to.be.revertedWith("DeMineAgent: only newly minted token allowed");
        await expect(
            nft.connect(user1).safeBatchTransferFrom(
                user1.address, agent.address, ids, supplies, []
            )
        ).to.be.revertedWith("DeMineAgent: only newly minted token allowed");

        // setup another ERC1155
        const ERC1155Test = await ethers.getContractFactory("ERC1155Test");
        erc1155Test = await ERC1155Test.connect(admin).deploy();
        await erc1155Test.deployed();

        await expect(
            erc1155Test.connect(admin).safeTransferFrom(
                admin.address, agent.address, 0, 10, []
            )
        ).to.be.revertedWith("DeMineAgent: only nft contract allowed");

        await expect(
            erc1155Test.connect(admin).safeBatchTransferFrom(
                admin.address, agent.address, [0, 1], [10, 10], []
            )
        ).to.be.revertedWith("DeMineAgent: only nft contract allowed");
    });

    it("redeem", async function () {
        const { admin, custodian, users: [user1, user2, _] } = signers;
        const { nft, agent, payments: [p1, p2, p3] } = contracts;

        let numCycles = 120;
        let supplies = Array(numCycles).fill(100);
        await nft.connect(admin).newPool(
            10, numCycles, supplies, 1000, 2000, user1.address
        ); // pool 1
        await nft.connect(admin).newPool(
            10, numCycles, supplies, 1000, 2000, user2.address
        ); // pool 2
        await utils.airdrop(p1, admin, user1, agent, 100000000);
        await utils.airdrop(p2, admin, user1, agent, 100000000);
        await agent.connect(admin).setPayment(p2.address, false);

        let pool = 1;
        let cycles = [10, 11];
        let amounts = [100, 100];
        await expect(
            agent.connect(user1).redeem(
                p1.address, pool, cycles, [100, 100, 100]
            )
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user1).redeem(p2.address, pool, cycles, amounts)
        ).to.be.revertedWith("DeMineAgent: payment not supported");

        await expect(
            agent.connect(user1).redeem(p1.address, pool, cycles, [1000, 1000])
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");

        await expect(
            agent.connect(user1).redeem(p1.address, 2, cycles, amounts)
        ).to.be.revertedWith("DeMineAgent: only pool owner allowed");

        await expect(
            agent.connect(user1).redeem(p3.address, pool, cycles, amounts)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        let ids = cycles.map(c => utils.id(pool, c));
        let half = amounts.map(s => s / 2);
        await utils.checkBalances(agent, ids, amounts);
        await expect(
            agent.connect(user1).redeem(p1.address, pool, cycles, half)
        ).to.emit(agent, "Redeem").withArgs(
            user1.address, pool, p1.address
        ).to.emit(nft, "TransferBatch").withArgs(
            agent.address, agent.address, user1.address, ids, half
        ).to.emit(p1, "Transfer").withArgs(
            user1.address, custodian.address, 1000 * 50 * 2
        );
        await utils.checkBalances(agent, ids, half);
    });

    it("update allowance", async function () {
        const { admin, users: [user1, user2, _] } = signers;
        const { nft, agent } = contracts;
        await mint(user1, user2);

        let pool = 1;
        let cycles = [10, 11];
        let ids = cycles.map(c => utils.id(pool, c));

        // increase
        await expect(
            agent.connect(user1).increaseAllowance(
                user2.address, 2, cycles, [50, 50]
            )
        ).to.be.revertedWith("DeMineAgent: only pool owner allowed");

        await expect(
            agent.connect(user1).increaseAllowance(
                user2.address, pool, cycles, [100]
            )
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        let increaseAllowance = async function (to, delta, total) {
            await expect(
                agent.connect(user1).increaseAllowance(
                    to, pool, cycles, delta
                )
            ).to.emit(agent, "IncreaseAllowance").withArgs(
                user1.address,
                to,
                pool,
                cycles,
                delta
            );
            await checkAllowances(to, ids, total);
        }
        await increaseAllowance(user2.address, [20, 20], [20, 20]);
        await increaseAllowance(user2.address, [100, 100], [120, 120]);
        await increaseAllowance(address0, [20, 20], [20, 20]);
        await increaseAllowance(address0, [100, 100], [120, 120]);

        // decrease
        await expect(
            agent.connect(user1).increaseAllowance(
                user2.address, 2, cycles, [50, 50]
            )
        ).to.be.revertedWith("DeMineAgent: only pool owner allowed");

        await expect(
            agent.connect(user1).decreaseAllowance(
                user2.address, pool, cycles, [100]
            )
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user1).decreaseAllowance(
                user2.address, pool, cycles, [200, 200]
            )
        ).to.be.revertedWith("DeMineAgent: decreased allowance below zero");

        let decreaseAllowance = async function (to, delta, total) {
            await expect(
                agent.connect(user1).decreaseAllowance(
                    to, pool, cycles, delta
                )
            ).to.emit(agent, "DecreaseAllowance").withArgs(
                user1.address,
                to,
                pool,
                cycles,
                delta
            );
            await checkAllowances(to, ids, total);
        }
        await decreaseAllowance(user2.address, [20, 20], [100, 100]);
        await decreaseAllowance(user2.address, [100, 100], [0, 0]);
        await decreaseAllowance(address0, [100, 100], [20, 20]);
        await decreaseAllowance(address0, [20, 20], [0, 0]);
    });

    it("claim", async function () {
        const { admin, custodian, users: [user1, user2, _] } = signers;
        const { nft, agent, payments: [p1, p2, p3] } = contracts;
        await agent.connect(admin).setPayment(p2.address, false);

        let pool = 1;
        let cycles = [10, 20, 30];
        let ids = cycles.map(c => utils.id(pool, c));

        await mint(user1, user2);

        await expect(
            agent.connect(user2).claim(
                p1.address, pool, cycles, [1, 1, 1]
            )
        ).to.be.revertedWith("DeMineAgent: insufficient allowance");

        await expect(
            agent.connect(user2).claimUnnamed(
                p1.address, pool, cycles, [1, 1, 1]
            )
        ).to.be.revertedWith("DeMineAgent: insufficient allowance");

        let allowances = [100, 100, 100];
        await agent.connect(user1).increaseAllowance(
            user2.address, pool, cycles, allowances
        );
        await agent.connect(user1).increaseAllowance(
            address0, pool, cycles, allowances
        );
        await checkAllowances(user2.address, ids, allowances);
        await checkAllowances(address0, ids, allowances);
        await agent.connect(user1).setPrices(pool, [10, 20], [4000, 3000]);

        // test start
        let half = allowances.map(a => a / 2);
        await expect(
            agent.connect(user2).claim(
                p1.address, pool, cycles, [30, 30]
            )
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user2).claimUnnamed(
                p1.address, pool, cycles, [30, 30]
            )
        ).to.be.revertedWith("DeMineAgent: array length mismatch");

        await expect(
            agent.connect(user2).claim(p2.address, pool, cycles, half)
        ).to.be.revertedWith("DeMineAgent: payment not supported");

        await expect(
            agent.connect(user2).claimUnnamed(p2.address, pool, cycles, half)
        ).to.be.revertedWith("DeMineAgent: payment not supported");

        await expect(
            agent.connect(user2).claim(p1.address, pool, cycles, half)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        await expect(
            agent.connect(user2).claimUnnamed(p1.address, pool, cycles, half)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        let totalPrice = (4000 + 3000 + 2000) * 50;
        await utils.airdrop(p1, admin, user2, agent, 10000000000);

        await expect(
            agent.connect(user2).claim(p1.address, pool, cycles, half)
        ).to.emit(agent, "Claim").withArgs(
            user2.address, user2.address, pool, p1.address
        ).to.emit(nft, "TransferBatch").withArgs(
            agent.address, agent.address, user2.address, ids, half
        ).to.emit(p1, "Transfer").withArgs(
            user2.address, custodian.address, totalPrice
        );
        await checkAllowances(user2.address, ids, half);

        await expect(
            agent.connect(user2).claimUnnamed(p1.address, pool, cycles, half)
        ).to.emit(agent, "Claim").withArgs(
            user2.address, address0, pool, p1.address
        ).to.emit(nft, "TransferBatch").withArgs(
            agent.address, agent.address, user2.address, ids, half
        ).to.emit(p1, "Transfer").withArgs(
            user2.address, custodian.address, totalPrice
        );
        await checkAllowances(address0, ids, half);

        await expect(
            agent.connect(user2).claim(p1.address, pool, cycles, half)
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");

        await expect(
            agent.connect(user2).claimUnnamed(p1.address, pool, cycles, half)
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("cashout", async function () {
        const { admin, custodian, users: [user1, user2, _u3] } = signers;
        const { nft, agent, rewardToken, payments: [p1, _] } = contracts;
        await mint(user1, user2);

        // reward cycle 1-20
        for (let i = 1; i < 10; i++) {
            await utils.rewardNext(contracts, signers, i, 0, 0);
        }
        for (let i = 10; i < 20; i++) {
            await utils.rewardNext(contracts, signers, i, 200, 200);
        }

        let ids = [utils.id(1, 10), utils.id(2, 20)];
        let amounts = [50, 50];
        await expect(
            agent.connect(user1).cashout(ids, amounts)
        ).to.be.revertedWith(OwnableError);

        await expect(
            agent.connect(admin).cashout(ids, amounts)
        ).to.be.revertedWith("DeMineNFT: unrewarded cycle");

        ids = [utils.id(1, 10), utils.id(2, 19)];
        await expect(
            agent.connect(admin).cashout(ids, [100, 50])
        ).to.emit(nft, "Cashout").withArgs(
            agent.address, agent.address, custodian.address, 100 + 50
        ).to.emit(nft, "TransferBatch").withArgs(
            agent.address, agent.address, address0, ids, [100, 50]
        );

        // token already cashed out, should fail
        await expect(
            agent.connect(admin).cashout(ids, amounts)
        ).to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });
    */
});

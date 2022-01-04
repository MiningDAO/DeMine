const { expect } = require("chai");
const { ethers } = require("hardhat");

const base = ethers.BigNumber.from(2).pow(128);

async function setupERC20() {
    // setup token factory
    const TokenFactory = await ethers.getContractFactory("WrappedTokenCloneFactory");
    tokenFactory = await TokenFactory.deploy();
    await tokenFactory.deployed();
    const Token = await ethers.getContractFactory("WrappedToken");
    return [tokenFactory, Token];
}

async function setupRewardToken(admin) {
    const [tokenFactory, Token] = await setupERC20();
    const tx = await tokenFactory.create("Reward", "REWARD", 8, admin.address);
    const { events: events } = await tx.wait();
    const { address: address } = events.find(Boolean);
    return await Token.attach(address);
}

async function setupPaymentTokens(admin, num) {
    const [tokenFactory, Token] = await setupERC20();
    let payments = [];
    for (let i = 0; i < num; i++) {
        const tx = await tokenFactory.create(
            "Cost" + i,
            "COST" + i,
            6,
            admin.address
        );
        const { events: events } = await tx.wait();
        const { address: address } = events.find(Boolean);
        payments.push(await Token.attach(address));
    }

    return payments;
}

function toAddresses(values) {
    return values.map(v => v.address);
}

async function setupDeMine(signers) {
    const rewardToken = await setupRewardToken(signers.admin);
    const payments = await setupPaymentTokens(signers.admin, 3);

    const DeMineFactory = await ethers.getContractFactory("DeMineCloneFactory");
    demineFactory = await DeMineFactory.deploy();
    await demineFactory.deployed();

    const NFT = await ethers.getContractFactory("DeMineNFT");
    const Agent = await ethers.getContractFactory("DeMineAgent");
    const tx = await demineFactory.create(
        // nft
        "demine_nft",
        signers.royaltyRecipient.address,
        100,
        rewardToken.address,
        // agent
        toAddresses(payments),
        signers.custodian.address,
        // owner
        signers.admin.address
    );
    const { events: events } = await tx.wait();
    const { args: [nftAddr, agentAddr] } = events.find(
        function(e) { return e.event === 'NewContract'; }
    );
    nft = await NFT.attach(nftAddr);
    agent = await Agent.attach(agentAddr);
    return { rewardToken, payments, nft, agent };
}

function id(pool, cycle) {
    return base.mul(pool).add(cycle);
}

function ids(pool, startCycle, numCycles) {
    var ids = [];
    for (let i = 0; i < numCycles; i++) {
        ids[i] = id(pool, startCycle + i);
    }
    return ids;
}

async function checkBalances(user, ids, amounts) {
    let users = Array(ids.length).fill(user.address);
    let balances = await nft.balanceOfBatch(users, ids);
    for (let i = 0; i < balances.length; i++) {
        expect(balances[i]).to.equal(amounts[i]);
    }
}

async function signers() {
    [
        user1,
        user2,
        user3,
        admin,
        rewarder,
        custodian,
        royaltyRecipient
    ] = await ethers.getSigners();
    return {
        admin: admin,
        rewarder: rewarder,
        royaltyRecipient: royaltyRecipient,
        custodian: custodian,
        users: [user1, user2, user3]
    };
}

async function rewardNext(contracts, signers, cycle, supply, totalReward) {
    let { nft, rewardToken} = contracts;
    let { rewarder, admin } = signers;
    let rewarderBalance = await rewardToken.balanceOf(rewarder.address);
    let nftBalance = await rewardToken.balanceOf(nft.address);

    // mint new reward tokens for rewarder
    await rewardToken.connect(admin).mint(rewarder.address, totalReward);
    expect(
        await rewardToken.balanceOf(rewarder.address)
    ).to.equal(rewarderBalance.add(totalReward));
    await rewardToken.connect(
        rewarder
    ).increaseAllowance(nft.address, totalReward);

    // reward tokens to nft contract from rewarder
    let rewardPerToken = 0;
    if (supply > 0) {
        rewardPerToken = Math.floor(totalReward / supply);
    }
    await expect(
        nft.connect(admin).rewardNext(rewarder.address, totalReward)
    ).to.emit(nft, "Reward").withArgs(
        cycle,
        rewarder.address,
        rewardPerToken,
        supply
    );

    // check reward token balance of rewarder and nft contract
    expect(
        await rewardToken.balanceOf(rewarder.address)
    ).to.equal(rewarderBalance.add(totalReward - rewardPerToken * supply));
    expect(
        await rewardToken.balanceOf(nft.address)
    ).to.equal(nftBalance.add(rewardPerToken * supply));
}

async function airdrop(token, admin, owner, spender, value) {
    await token.connect(admin).mint(owner.address, value);
    await token.connect(owner).approve(spender.address, value);
}

async function mintAndRedeem(contracts, admin, user) {
    let { nft, agent, payments: [p1, _] } = contracts;
    // create pools
    for (let i = 1; i <= 3; i++) {
        await nft.connect(admin).newPool(
            10 * i,
            120,
            Array(120).fill(100 * i),
            1000 * i,
            2000 * i,
            user.address
        )
    }

    //tokens to redeem
    let ids = [];
    let amounts = [];
    for (let i = 10; i < 40; i++) {
        if (i < 20) {
            ids.push(id(1, i));
            amounts.push(10);
        } else if (i < 30) {
            ids.push(id(2, i));
            amounts.push(20);
        } else {
            ids.push(id(3, i));
            amounts.push(30);
        }
    }

    await airdrop(p1, admin, user, agent, 100000000);
    await redeem(agent, user, p1, ids, amounts);
    return { ids, amounts };
};

async function redeem(agent, user, payment, ids, amounts) {
    let result = {};
    for (let i = 0; i < ids.length; i++) {
        let cycle = ids[i].mod(base);
        let pool = ids[i].sub(cycle).div(base);

        setDefault(result, pool, {});
        setDefault(result[pool], 'cycles', []);
        setDefault(result[pool], 'amounts', []);

        result[pool]['cycles'].push(cycle.toNumber());
        result[pool]['amounts'].push(amounts[i]);
    }
    let pools = Object.keys(result);
    for (let i = 0; i < pools.length; i++) {
        let pool = pools[i];
        await agent.connect(user).redeem(
            payment.address,
            pool,
            result[pool]['cycles'],
            result[pool]['amounts']
        );
    }
}

function setDefault(obj, key, value) {
    if (obj[key] === undefined) {
        obj[key] = value;
    }
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

function range(start, end) {
  return Array(end - start).fill().map((_, idx) => start + idx)
}

module.exports = {
    setupDeMine,
    airdrop,
    mintAndRedeem,
    id,
    ids,
    checkBalances,
    signers,
    rewardNext,
    compareArray,
    redeem,
    range
};

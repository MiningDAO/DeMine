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
    let costTokens = [];
    for (let i = 0; i < num; i++) {
        const tx = await tokenFactory.create(
            "Cost" + i,
            "COST" + i,
            6,
            admin.address
        );
        const { events: events } = await tx.wait();
        const { address: address } = events.find(Boolean);
        costTokens.push(await Token.attach(address));
    }

    return costTokens;
}

function toAddresses(values) {
    return values.map(v => v.address);
}

async function setupDeMine(rewardToken, costTokens, signers) {
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
        toAddresses(costTokens),
        toAddresses(signers.costRecipients),
        signers.rewardRecipient.address,
        // owner
        signers.admin.address
    );
    const { events: events } = await tx.wait();
    const { args: [nftAddr, agentAddr] } = events.find(
        function(e) { return e.event === 'NewContract'; }
    );
    nft = await NFT.attach(nftAddr);
    agent = await Agent.attach(agentAddr);
    return { nft, agent };
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

async function checkBalances(users, ids, amounts) {
    let balances = await nft.balanceOfBatch(users, ids);
    for (let i = 0; i < balances.length; i++) {
        expect(balances[i].eq(amounts[i])).to.be.true;
    }
}

async function signers() {
    [
        user1,
        user2,
        user3,
        admin,
        costRecipient1,
        costRecipient2,
        costRecipient3,
        rewarder,
        rewardRecipient,
        royaltyRecipient
    ] = await ethers.getSigners();
    return {
        admin: admin,
        rewarder: rewarder,
        royaltyRecipient: royaltyRecipient,
        rewardRecipient: rewardRecipient,
        costRecipients: [
            costRecipient1,
            costRecipient2,
            costRecipient3
        ],
        users: [user1, user2, user3]
    };
}

async function reward(nft, rewardToken, signers, cycle, supply, totalReward) {
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
        nft.connect(admin).reward(rewarder.address, totalReward)
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

async function mintAndRedeem(nft, agent, rewardToken, costTokens, signers, user) {
        let admin = signers.admin;
        // create pools
        for (let i = 1; i <= 3; i++) {
            await nft.connect(signers.admin).newPool(
                "pool",
                10 * i,
                120,
                Array(120).fill(100 * i),
                1000 * i,
                user.address
            )
        }

        // reward cycle 1-9, 0 per nft
        for (let i = 1; i < 10; i++) {
            await reward(nft, rewardToken, signers, i, 0, 0);
        }
        // reward cycle 10-19, 3 per nft
        for (let i = 10; i < 20; i++) {
            await reward(nft, rewardToken, signers, i, 100, 300);
        }
        // reward cycle 20-29, 2 per nft
        for (let i = 20; i < 30; i++) {
            await reward(nft, rewardToken, signers, i, 300, 600);
        }
        // reward cycle 20-29, 2 per nft
        for (let i = 30; i < 40; i++) {
            await reward(nft, rewardToken, signers, i, 600, 600);
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
            } else if (i < 40) {
                ids.push(id(3, i));
                amounts.push(30);
            }
        }

        // get cost tokens to redeem
        await costTokens[0].connect(
            admin
        ).mint(user.address, 10000000);
        await costTokens[0].connect(user).approve(agent.address, 10000000);
        await agent.connect(user).redeem(costTokens[0].address, ids, amounts);
        return { ids, amounts };
    };


module.exports = {
    setupRewardToken,
    setupPaymentTokens,
    setupDeMine,
    mintAndRedeem,
    id,
    ids,
    checkBalances,
    signers,
    reward,
};
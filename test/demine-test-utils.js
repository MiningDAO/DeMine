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

module.exports = {
    setupRewardToken,
    setupPaymentTokens,
    setupDeMine,
    id,
    ids
};

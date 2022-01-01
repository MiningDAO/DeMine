const { ethers } = require("hardhat");

const base = ethers.BigNumber.from(2).pow(128);

async function setupERC20() {
    // setup token factory
    const TokenFactory = await ethers.getContractFactory("WrappedTokenCloneFactory");
    tokenFactory = await TokenFactory.deploy();
    await tokenFactory.deployed();
    return await ethers.getContractFactory("WrappedToken");
}

async function setupRewardToken(admin) {
    const Token = setupERC20();
    const tx = await tokenFactory.create("Reward", "REWARD", 8, admin.address);
    const { events: events } = await tx.wait();
    const { address: address } = events.find(Boolean);
    return await Token.attach(address);
}

async function setupPaymentTokens(admin, num) {
    const Token = setupERC20();
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

function toAddresses(signers) {
    return signers.map(s => s.address);
}

async function setupDeMine(signers) {
    const NFT = await ethers.getContractFactory("DeMineNFT");
    const Agent = await ethers.getContractFactory("DeMineAgent");
    const tx = await demineFactory.create(
        // nft
        "demine_nft",
        signers.royaltyRecipient.address,
        100,
        // agent
        toAddresses(signer.costTokens),
        toAddresses(signer.costRecipients),
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

function newPool(
    pool,
    startCycle,
    numCycles,
    supplyPerCycle
) {
    var ids = [];
    var supplies = [];
    for (let i = 0; i < numCycles; i++) {
        ids[i] = id(pool, startCycle + i);
        supplies[i] = supplyPerCycle;
    }
    return { ids, supplies };
}

module.exports = {
    setupRewardToken,
    setupPaymentTokens,
    setup,
    id,
    newPool
};

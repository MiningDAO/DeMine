const { ethers } = require("hardhat");

const base = ethers.BigNumber.from(2).pow(128);

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

module.exports = { id, newPool };

const { expect } = require("chai");
const { ethers } = hre = require("hardhat");
const config = require("../lib/config.js");

const { logger } = require('../lib/logger.js');
const transport = logger.transports.find(
    t => t.name == 'console'
);
transport.level = 'warn';

describe("Mining3", function () {
    const coin = 'btc';
    var mining3, admin;

    beforeEach(async function() {
        admin = await config.admin(hre);
        await hre.deployments.fixture(['Local', 'Mining3']);
        mining3 = await hre.run('mining3-clone', {coin: coin});
        beacon = await config.getDeployment(hre, 'UpgradeableBeacon');
    });

    it("metedata check", async function() {
    });
});


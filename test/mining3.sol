const { expect } = require("chai");
const { ethers } = hre = require("hardhat");

const { logger } = require('../lib/logger.js');
const transport = logger.transports.find(
    t => t.name == 'console'
);
transport.level = 'warn';

describe("Mining3", function () {
    beforeEach(async function() {
    });

    it("finalize", async function() {
    });
});


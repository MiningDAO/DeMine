const assert = require("assert");
const time = require("../lib/time.js");
const config = require("../lib/config.js");

function validateCommon(args, hre) {
    assert(network.name !== 'hardhat', 'Not supported at hardhat network');
    config.validateCoin(args.coin);
}

module.exports = {
    validateCommon,
}

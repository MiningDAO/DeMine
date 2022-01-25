const assert = require("assert");
const constants = require("./constants.js");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
}

module.exports = {
    gas: gas,
    validateCoin: validateCoin
}

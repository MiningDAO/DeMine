const assert = require("assert");
const prompts = require('prompts');
const constants = require("./constants.js");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
}

async function prompt(func) {
    await (async () => {
        const response = await prompts({
          type: 'text',
          name: 'continue',
          message: 'Confirm to continue? (Y/n) '
        });
        var answer = response['continue'].toLowerCase();
        if (answer == 'y' || answer == 'yes') {
            const tx = await func();
            const txReceipt = await tx.wait();
            console.log('Transaction Succeded:');
            console.log(JSON.stringify({
                gas: gas(txReceipt),
                txhash: txReceipt.transactionHash
            }, null, 2));
        }
    })();
}

module.exports = {
    gas: gas,
    validateCoin: validateCoin,
    prompt: prompt
}

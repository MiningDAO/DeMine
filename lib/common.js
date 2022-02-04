const { expect } = require("chai");
const assert = require("assert");
const prompts = require('prompts');
const constants = require("./constants.js");
const fs = require('fs');

function setDeep(obj, path, value) {
    if (path.length == 1) {
        obj[path] = value
        return;
    }
    if (obj[path[0]] == undefined) {
        obj[path[0]] = {}
    }
    setDeep(obj[path[0]], path.slice(1), value);
}

function getDeep(obj, keys, defaultValue) {
    if (obj[keys[0]] === undefined) {
        return defaultValue;
    }
    if (keys.length == 1) {
        return obj[keys[0]];
    }
    return getDeep(obj[keys[0]], keys.slice(1), defaultValue);
}

async function getDeployment(hre, name) {
    var deployment = await hre.deployments.get(name);
    return await hre.ethers.getContractAt(name, deployment.address);
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
}

function toNumber(value) {
    return value ? value.toNumber() : undefined;
}

async function prompt(func) {
    return await (async () => {
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
                cumulativeGasUsed: toNumber(txReceipt.cumulativeGasUsed),
                gasPrice: toNumber(txReceipt.effectiveGasPrice),
                txhash: txReceipt.transactionHash
            }, null, 2));
            return txReceipt;
        }
    })();
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

function print(data) {
    console.log(JSON.stringify(data, null, 2));
}

module.exports = {
    validateCoin: validateCoin,
    prompt: prompt,
    compareArray: compareArray,
    getDeployment: getDeployment,
    setDeep: setDeep,
    getDeep: getDeep,
    print: print
}

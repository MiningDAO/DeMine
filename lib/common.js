const { expect } = require("chai");
const assert = require("assert");
const p = require('prompts');
const fs = require('fs');
const logger = require('npmlog');

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

function toNumber(value) {
    return value ? value.toNumber() : undefined;
}

async function prompts(func) {
    return await (async () => {
        const response = await p({
          type: 'text',
          name: 'continue',
          message: 'Confirm to continue? (Y/n) '
        });
        var answer = response['continue'].toLowerCase();
        if (answer == 'y' || answer == 'yes') {
            return await func();
        }
    })();
}

async function run(func) {
    const tx = prompts(func);
    const txReceipt = await tx.wait();
    console.log('Transaction Succeded:');
    console.log(JSON.stringify({
        cumulativeGasUsed: toNumber(txReceipt.cumulativeGasUsed),
        gasPrice: toNumber(txReceipt.effectiveGasPrice),
        txhash: txReceipt.transactionHash
    }, null, 2));
    return txReceipt;
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

function print(data) {
    logger.info(JSON.stringify(data, null, 2));
}

async function confirmAndDeploy(hre, name, args) {
    const { deployer } = await hre.ethers.getNamedSigners();
    const { deploy, fetchIfDifferent } = hre.deployments;
    const toRun = async() => {
        await deploy(name, {
            from: deployer.address,
            args: args,
            log: true
        });
    };
    if (hre.network.name == 'hardhat') {
        return await toRun();
    } else {
        const { differences, address } = await fetchIfDifferent(
            name, {from: deployer.address, args: args}
        );
        if (differences) {
            console.log('Will deploy ' + name);
            return await prompts(toRun);
        } else {
            // will print 'reusing' info
            return await toRun();
        }
    }
}

module.exports = {
    prompts: prompts,
    run: run,
    confirmAndDeploy: confirmAndDeploy,
    compareArray: compareArray,
    setDeep: setDeep,
    getDeep: getDeep,
    print: print
}

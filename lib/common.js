const { expect } = require("chai");
const assert = require("assert");
const p = require('prompts');
const fs = require('fs');
const logger = require('./logger.js');

const memoize = (preix, timeout, func) => {
    const results = {};
    return async (...args) => {
        const argsKey = preix + '_' + JSON.stringify(args);
        const ts = new Date().getTime();
        if (!results[argsKey] || results[argsKey].expiredAt < ts) {
            results[argsKey] = {
                value: await func(...args),
                expiredAt: ts + timeout
            }
        }
        return results[argsKey].value;
    };
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

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

async function prompts(func, options={}) {
    if (options.skipPrompts) {
        return await func();
    }
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

async function execTx(hre, func, options={}) {
    const tx = hre.network.name == 'hardhat'
        ? await func()
        : await prompts(func, options);
    const txReceipt = await tx.wait();
    logger.info('Transaction Succeded: ' + JSON.stringify({
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
    const { differences, address } = await fetchIfDifferent(
        name, {from: deployer.address, args: args}
    );
    if (hre.network.name == 'hardhat' || !differences) {
        // will print 'reusing' info
        return await toRun();
    } else {
        logger.info('Will deploy ' + name + ' at ' + hre.network.name);
        return await prompts(toRun);
    }
}

async function run(hre, admin, contract, fun, args, options={}) {
    if (admin.type == 'GNOSIS') {
        const calldata = contract.interface.encodeFunctionData(
            fun, args
        );
        const safe = await gnosis.getSafe(hre, admin);
        return await gnosis.propose(
            hre, safe, contract.address, calldata, options
        );
    } else {
        await execTx(hre, async function() {
            return await contract.connect(
                admin.signer
            )[fun](...args);
        });
    }
}

module.exports = {
    prompts,
    execTx,
    run,
    confirmAndDeploy,
    compareArray,
    setDeep,
    getDeep,
    memoize,
    sleep,
}

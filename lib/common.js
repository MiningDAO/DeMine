const { expect } = require("chai");
const assert = require("assert");
const prompts = require('prompts');
const constants = require("./constants.js");

async function getDeployment(hre, name) {
    deployment = await hre.deployments.get(name);
    return await hre.ethers.getContractAt(name, deployment.address);
}

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
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
                gas: gas(txReceipt),
                txhash: txReceipt.transactionHash
            }, null, 2));
            return txReceipt;
        }
    })();
}

async function getInterface(hre, name) {
    const artifact = await hre.deployments.getArtifact(name);
    return new hre.ethers.utils.Interface(artifact.abi);
}

async function genSelectors(hre, nameFunctions) {
    const selectors = await Promise.all(nameFunctions.map(
        async ([name, functions]) => {
            const iface = await getInterface(hre, name);
            return functions.map(f => iface.getSighash(f));
        }
    ));
    return selectors.flat();
}

async function genInterfaces(hre, ifaceNames) {
    return await Promise.all(ifaceNames.map(
        async ifaceName => {
            const iface = await getInterface(hre, ifaceName);
            const selectors = Object.keys(iface.functions).map(f => iface.getSighash(f));
            return selectors.reduce(
                (prev, cur) => ethers.BigNumber.from(prev).xor(ethers.BigNumber.from(cur))
            );
        }
    ));
}

function address0(ethers) {
    return hre.ethers.utils.getAddress(
        "0x0000000000000000000000000000000000000000"
    );
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

module.exports = {
    gas: gas,
    validateCoin: validateCoin,
    prompt: prompt,
    genInterfaces: genInterfaces,
    genSelectors: genSelectors,
    address0: address0,
    compareArray: compareArray,
    getDeployment: getDeployment
}

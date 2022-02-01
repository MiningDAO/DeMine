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

function saveContract(hre, coin, key, value) {
    var contracts = require(hre.localConfig.contracts);
    setDeep(contracts, [hre.network.name, coin, key], value);
    fs.writeFileSync(
        hre.localConfig.contracts,
        JSON.stringify(contracts, null, 2)
    );
}

async function getDeployment(hre, name) {
    deployment = await hre.deployments.get(name);
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

async function genInterface(hre, ifaceName) {
    const iface = await getInterface(hre, ifaceName);
    const selectors = Object.keys(iface.functions).map(f => iface.getSighash(f));
    return selectors.reduce(
        (prev, cur) => ethers.BigNumber.from(prev).xor(ethers.BigNumber.from(cur))
    );
}

async function genInterfaces(hre, ifaceNames) {
    return await Promise.all(ifaceNames.map(
        async ifaceName => await genInterface(hre, ifaceName)
    ));
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

async function genFacetCut(hre, name, functions) {
    const facet = await getDeployment(hre, name);
    const selectors = await genSelectors(functions);
    return [facet.address, 0, selectors];
}

async function diamondInitArgs(
    hre,
    owner,
    fallback,
    fallbackInitArgs,
    facetCuts,
    ifaceNames
) {
    var selectorsRes = [];
    var facetsPosition = [];
    var selectorSlots = [];
    var i = 0;
    for (var [facet, _, selectors] of facetCuts) {
        for (var selector of selectors) {
            selectorsRes.push(selector);
            facetsPosition.push(
                hre.ethers.BigNumber.from(facet).shl(96).or(i)
            );
            var slot = i >> 8;
            if (selectorSlots.length == slot) {
                selectorSlots.push(hre.ethers.BigNumber.from(0));
            }
            var slotPosition = (i % 8) << 5;
            selectorSlots[slot] = selectorSlots[slot].or(
                hre.ethers.BigNumber.from(selector).shl(7 * 32).shr(slotPosition)
            );

            i++;
        }
    }
    return [
        owner,
        selectorsRes,
        facetsPosition.map(b => b.toHexString()),
        selectorSlots.map(
            b => hre.ethers.utils.hexZeroPad(b.toHexString(), 32)
        ),
        fallback,
        fallbackInitArgs,
        await genInterfaces(hre, ifaceNames)
    ];
}

module.exports = {
    validateCoin: validateCoin,
    prompt: prompt,
    genInterface: genInterface,
    genInterfaces: genInterfaces,
    genSelectors: genSelectors,
    compareArray: compareArray,
    getDeployment: getDeployment,
    genFacetCut: genFacetCut,
    diamondInitArgs: diamondInitArgs,
    saveContract: saveContract
}

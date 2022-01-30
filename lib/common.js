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

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

async function genFacetCut(hre, name, functions) {
    const facet = await getDeployment(hre, name);
    const selectors = await genSelectors(hre, functions);
    return [facet.address, 0, selectors];
}

async function genDiamondFacetCut(hre) {
    return await genFacetCut(hre, 'DiamondFacet', [
        ['IDiamondCuttable', ['diamondCut']]
    ]);
}

function diamondInit(fallback, facetCuts) {
    var selectorsRes = [];
    var facetsPosition = [];
    var selectorSlots = [];
    var i = 0;
    for (var [facet, _, selectors] of facetCuts) {
        for (var selector of selectors) {
            selectorsRes.push(selector);
            facetsPosition.push(
                ethers.BigNumber.from(facet).shl(96).or(i)
            );
            var slot = i >> 8;
            if (selectorSlots.length == slot) {
                selectorSlots.push(ethers.BigNumber.from(0));
            }
            var slotPosition = (i % 8) << 5;
            selectorSlots[slot] = selectorSlots[slot].or(
                ethers.BigNumber.from(selector).shl(7 * 32).shr(slotPosition)
            );

            i++;
        }
    }
    return [
        fallback,
        selectorsRes,
        facetsPosition.map(b => b.toHexString()),
        selectorSlots.map(b => ethers.utils.hexZeroPad(b.toHexString(), 32))
    ];
}

module.exports = {
    gas: gas,
    validateCoin: validateCoin,
    prompt: prompt,
    genInterfaces: genInterfaces,
    genSelectors: genSelectors,
    compareArray: compareArray,
    getDeployment: getDeployment,
    genFacetCut: genFacetCut,
    genDiamondFacetCut: genDiamondFacetCut,
    diamondInit: diamondInit
}

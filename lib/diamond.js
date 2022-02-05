const common = require('./common.js');

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

async function genFacetCut(hre, name, functions) {
    const facet = await common.getDeployment(hre, name);
    const selectors = await genSelectors(hre, functions);
    return [facet.address, 0, selectors];
}

module.exports = {
    genInterface: genInterface,
    genInterfaces: genInterfaces,
    genSelectors: genSelectors,
    genFacetCut: genFacetCut,
}

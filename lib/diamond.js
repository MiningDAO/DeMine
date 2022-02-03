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
    const facet = await getDeployment(hre, name);
    const selectors = await genSelectors(functions);
    return [facet.address, 0, selectors];
}

async function genInitArgs(
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
    genInterface: genInterface,
    genInterfaces: genInterfaces,
    genSelectors: genSelectors,
    genFacetCut: genFacetCut,
    genInitArgs: genInitArgs
}

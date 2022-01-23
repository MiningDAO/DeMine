const { types } = require("hardhat/config");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

async function getDeployment(hre, name) {
    const { deployer } = await hre.ethers.getNamedSigners();
    if (hre.network.name == 'hardhat') {
        deployment = await hre.deployments.getOrNull(name);
        if (deployment === undefined) {
            await hre.deployments.run(['DeMine']);
        }
    }
    deployment = await hre.deployments.get(name);
    return await hre.ethers.getContractAt(name, deployment.address, deployer);
}

async function genSelectors(hre, nameFunctions) {
    const selectors = await Promise.all(nameFunctions.map(
        async ([name, functions]) => {
            const artifact = await hre.deployments.getArtifact(name);
            const iface = new hre.ethers.utils.Interface(artifact.abi);
            return functions.map(f => iface.getSighash(f));
        }
    ));
    return selectors.flat();
}

async function genInterfaces(hre, ifaceNames) {
    return await Promise.all(ifaceNames.map(
        async ifaceName => {
            const artifact = await deployments.getArtifact(ifaceName);
            const iface = new ethers.utils.Interface(artifact.abi);
            const selectors = Object.keys(iface.functions).map(f => iface.getSighash(f));
            return selectors.reduce(
                (prev, cur) => ethers.BigNumber.from(prev).xor(ethers.BigNumber.from(cur))
            );
        }
    ));
}

async function genDeMineAdminFacetCut(hre) {
    const facet = await getDeployment(hre, 'DeMineAdminFacet');
    const selectors = await genSelectors(hre, [
        ['Ownable', ['owner']],
        ['SafeOwnable', ['nomineeOwner', 'transferOwnership', 'acceptOwnership']],
        ['IPausable', ['paused', 'pause', 'unpause']],
        ['ICloneable', ['clone', 'cloneDeterministic', 'predictDeterministicAddress']]
    ]);
    return [facet, 0, selectors];
}

async function genDiamondFacetCut(hre) {
    const facet = await getDeployment(hre, 'DiamondFacet');
    const selectors = await genSelectors(hre, [
        ['IDiamondCuttable', ['diamondCut']],
        ['IDiamondLoupe', ['facets', 'facetFunctionSelectors', 'facetAddresses', 'facetAddress']],
        ['DiamondFacet', ['getFallbackAddress', 'setFallbackAddress']]
    ]);
    return [facet, 0, selectors];
}

async function genERC1155FacetCut(hre) {
    const facet = await getDeployment(hre, 'ERC1155Facet');
    const selectors = await genSelectors(hre, [
        ['IERC1155', [
            'balanceOf',
            'balanceOfBatch',
            'isApprovedForAll',
            'setApprovalForAll',
            'safeTransferFrom',
            'safeBatchTransferFrom',
        ]],
        ['IERC1155Metadata', ['uri']],
        ['IERC2981', ['royaltyInfo']],
        ['ERC1155Facet', ['setBaseURI', 'setTokenURI', 'setRoyaltyInfo']]
    ]);
    return [facet, 0, selectors];
}

async function genDeMineNFTFacetCut(hre) {
    const facet = await getDeployment(hre, 'MiningPoolFacet');
    const selectors = await genSelectors(hre, [
        ['IMiningPool', ['alchemize', 'shrink', 'getMining']],
        ['MiningPoolFacet', ['finalize', 'expand', 'getTokenInfo']]
    ]);
    return [facet, 0, selectors];
}

async function genMortgageFacetCut(hre) {
    const facet = await getDeployment(hre, 'MortgageFacet');
    const selectors = await genSelectors(hre, [
        ['IERC1155Receiver', ['onERC1155Received', 'onERC1155BatchReceived']],
        ['MortgageFacet', ['redeem', 'payoff', 'adjustDeposit', 'getAccountInfo', 'balanceOfBatch']]
    ]);
    return [facet, 0, selectors];
}

async function genPrimaryMarketFacetCut(hre) {
    const facet = await getDeployment(hre, 'PrimaryMarketFacet');
    const selectors = await genSelectors(hre, [
        [
            'PrimaryMarketFacet',
            [
                'setPricingStrategy',
                'increaseAllowance',
                'decreaseAllowance',
                'claim',
                'getListedPrices',
                'getAllowances'
            ]
        ],
        ['PricingStatic', ['setStaticBase', 'setStaticOverride']],
        ['PricingLinearDecay', ['setLinearDecay']]
    ]);
    return [facet, 0, selectors];
}

async function genBillingFacetCut(hre) {
    const facet = await getDeployment(hre, 'BillingFacet');
    const selectors = await genSelectors(hre, [
        [
            'BillingFacet',
            [
                'tryBilling',
                'lockPrice',
                'buyWithLockedPrice',
                'closeBilling',
                'collectResidue',
                'resetShrink',
                'getStatement'
            ]
        ]
    ]);
    return [facet, 0, selectors];
}

subtask("clone-wrapped-token", "clone wrapped token")
    .addParam('name', 'Wrapped token name')
    .addParam('symbol', 'Wrapped token symbol')
    .addParam('decimals', 'Wrapped token decimals', undefined, types.int)
    .setAction(async function(args, { ethers } = hre) {
        const { admin } = await ethers.getNamedSigners();
        const Base = await getDeployment(hre, 'DeMineERC20');
        const tx = await Base.create(
            args.name, args.symbol, args.decimals, admin.address
        );
        const { events } = txReceipt = await tx.wait();
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log(
            'Cloning DeMineERC20 ' + args.symbol + ' at ' +
            cloned + ' with ' + gas(txReceipt) + ' gas'
        );
        return cloned;
    });

task('clone-demine-nft', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        const coinConfig = localNetworkConfig[args.coin] || {};
        var income;
        if (network.name == 'hardhat') {
            income = await hre.run('clone-wrapped-token', coinConfig.metadata);
        } else {
            income = coinConfig.wrapped;
        }

        const base = await getDeployment(hre, 'DeMineNFTV2');
        const interfaceIds = await genInterfaces(hre, [
            'ICloneable',
            'IERC173',
            'IPausable',
            'IDiamondCuttable',
            'IDiamondLoupe',
            'IERC165',
            'IERC1155',
            'IERC1155Metadata',
            'IERC2981',
            'IMiningPool'
        ]);
        const facetCuts = ethers.utils.AbiCoder.prototype.encode(
            Array(4).fill('tuple(address,uint8,bytes4[])'),
            [
                genDeMineAdminFacetCut(hre),
                genDiamondFacetCut(hre),
                genERC1155FacetCut(hre),
                genDiamondFacetCut(hre)
            ]
        );

        const tx = await base.create(
            await getDeployment(hre, 'DiamondFacet'),
            facetCuts,
            interfaces,
            income,
            custodian.address,
            100,
            localConfig.tokenUri,
            admin.address
        );
        const { events } = txReceipt = await tx.wait();
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log(
            'Cloning contract DeMineNFT at ' + nft +
            ' and DeMineAgent at ' + agent +
            ' with ' + gas(txReceipt) + ' gas'
        );
    });

task('clone-demine-agent', 'Deploy clone of demine agent')
    .addParam('coin', 'Coin type')
    .addParam('cost', 'Cost per token')
    .setAction(async (args, { ehters, network, deployments, localConfig } = hre) => {
        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        const coinConfig = localNetworkConfig[args.coin] || {};
        const paymentConfig = localNetworkConfig.payment || {};
        var income, nft, payment;
        if (network.name == 'hardhat') {
            nft = await hre.run('clone-demine-nft', {coin: args.coin});
            income = await hre.run('clone-wrapped-token', coinConfig.metadata);
            payment = await hre.run('clone-wrapped-token', paymentConfig.metadata);
        } else {
            income = coinConfig.wrapped;
            nft = coinConfig.nft;
            payment = coinConfig.wrapped;
            assert(
                income && nft && payment,
                'invalid income/payment/nft contract address'
            );
        }

        const interfaceIds = await genInterfaces(hre, [
            'ICloneable',
            'IERC173',
            'IPausable',
            'IDiamondCuttable',
            'IDiamondLoupe',
            'IERC165',
            'IERC1155Receiver'
        ]);
        const facetCuts = ethers.utils.AbiCoder.prototype.encode(
            Array(4).fill('tuple(address,uint8,bytes4[])'),
            [
                genDeMineAdminFacetCut(hre),
                genDiamondFacetCut(hre),
                genMortgageFacetCut(hre),
                genPrimaryMarketFacetCut(hre),
                genBillingFacetCut(hre)
            ]
        );

        const base = await getDeployment(hre, 'DeMineAgentV2');
        const tx = await base.create(
            await getDeployment(hre, 'DiamondFacet'),
            facetCuts,
            interfaces,
            coinConfig.nft,
            coinConfig.wrapped,
            paymentConfig.wrapped,
            custodian.address,
            localConfig.tokenCost,
            admin.address
        );
        const { events } = txReceipt = await tx.wait();
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log(
            'Cloning contract DeMineAgent at ' + cloned +
            ' and DeMineAgent at ' + agent +
            ' with ' + gas(txReceipt) + ' gas'
        );
    });

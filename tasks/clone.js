const { types } = require("hardhat/config");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

async function getDeployment(deployer, deployments, name) {
    var deployment = await deployments.getOrNull(name);
    if (deployment === undefined) {
        // for hardhat network
        await deployments.run([name]);
        deployment = await deployments.getOrNull(name);
    }
    return await ethers.getContractAt(name, deployment.address, deployer);
}

async function genSelectors(ethers, nameFunctions) {
    const selectors = await Promise.all(nameFunctions.map(
        async ([name, functions]) => {
            const factory = await ethers.getContractFactory(name);
            const iface = factory.interface;
            return functions.map(f => iface.getSighash(f));
        }
    ));
    return selectors.flat();
}

async function genInterfaces(ethers, ifaceNames) {
    return await Promise.all(names.map(
        async name => {
            const factory = await ethers.getContractFactory(ifaceName);
            const iface = factory.interface;
            const selectors = iface.functions.map(f => iface.getSighash(f));
            const interfaceId = selectors.reduce(
                (prev, cur) => ethers.BigNumber.from(prev).xor(ethers.BigNumber.from(cur))
            );
            return interfaceId;
        }
    ));
}

async function genDeMineAdminFacetCut(ethers, deployments) {
    const facet = await deployments.get('DeMineAdminFacet');
    const selectors = await genSelectors(ethers, [
        ['Ownable', ['owner']],
        ['Safeownable', ['nomineeOwner', 'transferOwnership', 'acceptOwnership']],
        ['IPausable', ['paused', 'pause', 'unpause']],
        ['ICloneable', ['clone', 'cloneDeterministic', 'predictDeterministicAddress']]
    ]);
    return [facet, 0, selectors];
}

async function genDiamondFacetCut(ethers, deployments) {
    const facet = await deployments.get('DiamondFacet');
    const selectors = await genSelectors(ethers, [
        ['IDiamondCuttable', ['diamondCut']],
        ['IDiamondLoupe', ['facets', 'facetFunctionSelectors', 'facetAddresses', 'facetAddress']],
        ['DiamondFacet', ['getFallbackAddress', 'setFallbackAddress']]
    ]);
    return [facet, 0, selectors];
}

async function genERC1155FacetCut(ethers, deployments) {
    const facet = await deployments.get('ERC1155Facet');
    const selectors = await genSelectors(ethers, [
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

async function genDeMineNFTFacetCut(ethers, deployments) {
    const facet = await deployments.get('MiningPoolFacet');
    const selectors = await genSelectors(ethers, [
        ['IMiningPool', ['alchemize', 'shrink', 'getMining']],
        ['MiningPoolFacet', ['finalize', 'expand', 'getTokenInfo']]
    ]);
    return [facet, 0, selectors];
}

async function genMortgageFacetCut(ethers, deployments) {
    const facet = await deployments.get('MortgageFacet');
    const selectors = await genSelectors(ethers, [
        ['IERC1155Receiver', ['onERC1155Received', 'onERC1155BatchReceived']],
        ['MortgageFacet', ['redeem', 'payoff', 'adjustDeposit', 'getAccountInfo', 'balanceOfBatch']]
    ]);
    return [facet, 0, selectors];
}

async function genPrimaryMarketFacetCut(ethers, deployments) {
    const facet = await deployments.get('PrimaryMarketFacet');
    const selectors = await genSelectors(ethers, [
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

async function genBillingFacetCut(ethers, deployments) {
    const facet = await deployments.get('BillingFacet');
    const selectors = await genSelectors(ethers, [
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
    .setAction(async function(args, { ethers, deployments }) {
        const { deployer, admin } = await ethers.getNamedSigners();
        const Base = await getDeployment(
            deployer, deployments, 'DeMineERC20'
        );
        const tx = await Base.clone(
            args.name, args.symbol, args.decimals
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
    .setAction(async (args, { ehters, network, deployments, localConfig }) => {
        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        const coinConfig = localNetworkConfig[args.coin] || {};
        var income;
        if (network.name == 'hardhat') {
            income = await hre.run('clone-wrapped-token', coinConfig.metadata);
        } else {
            income = coinConfig.wrapped;
        }

        const base = await getDeployment(deployer, deployments, 'DeMineNFTV2');
        const interfaceIds = await genInterfaces(
            ethers, [
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
            ]
        );
        const facetCuts = ethers.utils.AbiCoder.prototype.encode(
            Array(4).fill('tuple(address,uint8,bytes4[])'),
            [
                genDeMineAdminFacetCut(ethers, deployments),
                genDiamondFacetCut(ethers, deployments),
                genERC1155FacetCut(ethers, deployments),
                genDiamondFacetCut(ethers, deployments)
            ]
        );

        const tx = await base.clone(
            diamondFacet,
            facetCuts,
            interfaces,
            income,
            custodian.address,
            100,
            localConfig.tokenUri
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

        const base = await getDeployment(deployer, deployments, 'DeMineAgentV2');
        const interfaceIds = await genInterfaces(
            ethers, [
                'ICloneable',
                'IERC173',
                'IPausable',
                'IDiamondCuttable',
                'IDiamondLoupe',
                'IERC165',
                'IERC1155Receiver'
            ]
        );
        const facetCuts = ethers.utils.AbiCoder.prototype.encode(
            Array(4).fill('tuple(address,uint8,bytes4[])'),
            [
                genDeMineAdminFacetCut(ethers, deployments),
                genDiamondFacetCut(ethers, deployments),
                genMortgageFacetCut(ethers, deployments),
                genPrimaryMarketFacetCut(ethers, deployments),
                genBillingFacetCut(ethers, deployments)
            ]
        );

        const tx = await base.clone(
            diamondFacet,
            facetCuts,
            interfaces,
            coinConfig.nft,
            coinConfig.wrapped,
            paymentConfig.wrapped,
            custodian.address,
            localConfig.tokenCost
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

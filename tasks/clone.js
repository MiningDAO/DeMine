const { types } = require("hardhat/config");
const assert = require("assert");
const SUPPORTED_COINS = ['btc', 'eth', 'fil'];

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

async function genFacetCut(hre, name, functions) {
    const facet = await getDeployment(hre, name);
    const selectors = await genSelectors(hre, functions);
    return [facet.address, 0, selectors];
}

async function genDeMineAdminFacetCut(hre) {
    return await genFacetCut(hre, 'DeMineAdminFacet', [
        ['Ownable', ['owner']],
        ['SafeOwnable', ['nomineeOwner', 'transferOwnership', 'acceptOwnership']],
        ['IPausable', ['paused', 'pause', 'unpause']]
    ]);
}

async function genDiamondFacetCut(hre) {
    return await genFacetCut(hre, 'DiamondFacet', [
        ['IDiamondCuttable', ['diamondCut']],
        ['IDiamondLoupe', ['facets', 'facetFunctionSelectors', 'facetAddresses', 'facetAddress']],
        ['DiamondFacet', ['getFallbackAddress', 'setFallbackAddress']]
    ]);
}

async function genERC1155FacetCut(hre) {
    return await genFacetCut(hre, 'ERC1155Facet', [
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
        ['ERC1155Facet', ['mintBatch', 'burnBatch', 'setURI', 'setRoyaltyInfo']]
    ]);
}

async function genMiningPoolFacetCut(hre) {
    return await genFacetCut(hre, 'MiningPoolFacet', [
        ['IMiningPool', ['alchemize', 'shrink', 'getMining', 'treasureSource']],
        ['MiningPoolFacet', ['finalize', 'getTokenInfo']]
    ]);
}

async function genMortgageFacetCut(hre) {
    return await genFacetCut(hre, 'MortgageFacet', [
        ['IERC1155Receiver', ['onERC1155Received', 'onERC1155BatchReceived']],
        ['MortgageFacet', ['redeem', 'payoff', 'adjustDeposit', 'getAccountInfo', 'balanceOfBatch']]
    ]);
}

async function genPrimaryMarketFacetCut(hre) {
    return await genFacetCut(hre, 'PrimaryMarketFacet', [
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
}

async function genBillingFacetCut(hre) {
    return await genFacetCut(hre, 'BillingFacet', [
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
        assert(SUPPORTED_COINS.includes(args.coin), 'unsupported coin');

        const { admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        const coinConfig = localNetworkConfig[args.coin] || {};
        var income;
        if (network.name == 'hardhat') {
            income = await hre.run('clone-wrapped-token', coinConfig.metadata);
        } else {
            income = coinConfig.wrapped;
        }
        assert(income, 'invalid income contract address');

        const diamondFacet = await getDeployment(hre, 'DiamondFacet');
        const base = await getDeployment(hre, 'DeMineNFT');
        const tx = await base.create(
            diamondFacet.address,
            [
                await genDeMineAdminFacetCut(hre),
                await genDiamondFacetCut(hre),
                await genERC1155FacetCut(hre),
                await genMiningPoolFacetCut(hre)
            ],
            await genInterfaces(hre, [
                'IERC173',
                'IPausable',
                'IDiamondCuttable',
                'IDiamondLoupe',
                'IERC165',
                'IERC1155',
                'IERC1155Metadata',
                'IERC2981',
                'IMiningPool'
            ]),
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
            'Cloning contract DeMineNFT at ' + cloned +
            ' with ' + gas(txReceipt) + ' gas'
        );
        return cloned;
    });

task('clone-demine-agent', 'Deploy clone of demine agent')
    .addOptionalParam('nft', 'contract address of DeMineNFT', undefined)
    .addParam('coin', 'Coin type')
    .addParam('cost', 'Cost per token')
    .setAction(async (args, { ehters, network, deployments, localConfig } = hre) => {
        assert(SUPPORTED_COINS.includes(args.coin), 'unsupported coin');

        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        const coinConfig = localNetworkConfig[args.coin] || {};
        const paymentConfig = localNetworkConfig.payment || {};
        var nft, income, payment;
        if (network.name == 'hardhat') {
            nft = await hre.run('clone-demine-nft', {coin: args.coin, income: income});
            payment = await hre.run('clone-wrapped-token', paymentConfig.metadata);
        } else {
            nft = coinConfig.nft;
            payment = coinConfig.wrapped;
        }
        assert(nft && payment, 'invalid nft or payment contract address');

        const diamondFacet = await getDeployment(hre, 'DiamondFacet');
        const base = await getDeployment(hre, 'DeMineAgent');
        const tx = await base.create(
            diamondFacet.address,
            [
                await genDeMineAdminFacetCut(hre),
                await genDiamondFacetCut(hre),
                await genMortgageFacetCut(hre),
                await genPrimaryMarketFacetCut(hre),
                await genBillingFacetCut(hre)
            ],
            await genInterfaces(hre, [
                'ICloneable',
                'IERC173',
                'IPausable',
                'IDiamondCuttable',
                'IDiamondLoupe',
                'IERC165',
                'IERC1155Receiver'
            ]),
            nft,
            payment,
            custodian.address,
            args.cost,
            admin.address
        );
        const { events } = txReceipt = await tx.wait();
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log(
            'Cloning contract DeMineAgent at ' + cloned +
            ' with ' + gas(txReceipt) + ' gas'
        );
    });

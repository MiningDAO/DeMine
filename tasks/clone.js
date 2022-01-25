const { types } = require("hardhat/config");
const assert = require("assert");
const common = require("../lib/common.js");

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

async function genFacetCut(hre, name, functions) {
    const facet = await getDeployment(hre, name);
    const selectors = await common.genSelectors(hre, functions);
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
        ['IDiamondCuttable', ['diamondCut']]
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
        ['IMiningPool', ['alchemize', 'treasureSource']],
        ['MiningPoolFacet', ['finalize']]
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

task("clone-wrapped-token", "clone wrapped token")
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
            cloned + ' with ' + common.gas(txReceipt) + ' gas'
        );
        return cloned;
    });

task('clone-demine-nft', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        common.validateCoin(args.coin);

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
        const erc1155Facet = await getDeployment(hre, 'ERC1155Facet');
        const base = await getDeployment(hre, 'DeMineNFT');
        const tx = await base.create(
            admin.address,
            diamondFacet.address,
            erc1155Facet.address,
            [
                await genDiamondFacetCut(hre),
                await genMiningPoolFacetCut(hre)
            ],
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
            'Cloning contract DeMineNFT at ' + cloned +
            ' with ' + common.gas(txReceipt) + ' gas'
        );
        return cloned;
    });

task('clone-demine-agent', 'Deploy clone of demine agent')
    .addOptionalParam('nft', 'contract address of DeMineNFT', undefined)
    .addParam('coin', 'Coin type')
    .addParam('cost', 'Cost per token')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
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
        const mortgageFacet = await getDeployment(hre, 'MortgageFacet');
        const base = await getDeployment(hre, 'DeMineAgent');
        const tx = await base.create(
            admin.address,
            diamondFacet.address,
            mortgageFacet,
            [
                await genDiamondFacetCut(hre),
                await genPrimaryMarketFacetCut(hre),
                await genBillingFacetCut(hre)
            ],
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
            ' with ' + common.gas(txReceipt) + ' gas'
        );
    });

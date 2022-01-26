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
        ['IDiamondCuttable', ['diamondCut']],
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

task("init-wrapped-token", "init wrapped token")
    .addParam('contract', 'contract address')
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers, localConfig } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const erc20 = await ethers.getContractAt('DeMineERC20', args.contract);

        const config = localConfig.wrapped[args.coin];
        console.log('Will initialize DeMineERC20 ' + args.contract + ' with: ');
        console.log(JSON.stringify({
            name: config.name,
            symbol: config.symbol,
            decimals: config.decimals,
            owner: admin.address
        }, null, 2));
        await common.prompt(async function() {
            return await erc20.connect(admin).initialize(
                config.name, config.symbol, config.decimals, admin.address
            );
        });
    });

task("clone-wrapped-token", "clone wrapped token")
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const Base = await getDeployment(hre, 'DeMineERC20');
        const config = localConfig.wrapped[args.coin];

        console.log('Will clone DeMineERC20 from ' + Base.address + ' with: ');
        console.log(JSON.stringify({
            name: config.name,
            symbol: config.symbol,
            decimals: config.decimals,
            owner: admin.address
        }, null, 2));
        const { events } = await common.prompt(async function() {
            return await Base.create(
                config.name, config.symbol, config.decimals, admin.address
            );
        });
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned DeMineERC20 at ' + cloned);
        return cloned;
    });

task("init-demine-nft", "init wrapped token")
    .addParam('contract', 'contract address')
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        const nft = await ethers.getContractAt('DeMineNFT', args.contract);
        let localNetworkConfig = localConfig[network.name] || {};
        const income = await ethers.getContractAt(
            'DeMineERC20', localNetworkConfig[args.coin].wrapped
        );

        const diamondFacet = await getDeployment(hre, 'DiamondFacet');
        const erc1155Facet = await getDeployment(hre, 'ERC1155Facet');
        const facetCuts = [
            await genDiamondFacetCut(hre),
            await genMiningPoolFacetCut(hre)
        ];
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        console.log('Will initialize DeMineNFT ' + args.contract + ' with: ');
        console.log(JSON.stringify({
            owner: admin.address,
            diamondFacet: diamondFacet.address,
            erc1155Facet: erc1155Facet.address,
            fallbackAddress: erc1155Facet.address,
            facetCuts: facetCuts,
            income: {
                address: income.address,
                name: await income.name(),
                symbol: await income.symbol(),
                decimals: await income.decimals()
            },
            royaltyRecipient: custodian.address,
            royaltyBps: royaltyBps,
            baseUri: uri
        }, null, 2));
        await common.prompt(async function() {
            return await nft.connect(admin).initialize(
                admin.address,
                diamondFacet.address,
                erc1155Facet.address,
                facetCuts,
                income.address,
                custodian.address,
                royaltyBps,
                uri
            );
        });
    });

task('clone-demine-nft', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};
        const coinConfig = localNetworkConfig[args.coin];
        const income = await ethers.getContractAt('DeMineERC20', coinConfig.wrapped);

        const diamondFacet = await getDeployment(hre, 'DiamondFacet');
        const erc1155Facet = await getDeployment(hre, 'ERC1155Facet');
        const facetCuts = [
            await genDiamondFacetCut(hre),
            await genMiningPoolFacetCut(hre)
        ];
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const Base = await getDeployment(hre, 'DeMineNFT');

        console.log('Will clone DeMineNFT from ' + Base.address + ' with: ');
        console.log(JSON.stringify({
            owner: admin.address,
            diamondFacet: diamondFacet.address,
            erc1155Facet: erc1155Facet.address,
            fallbackAddress: erc1155Facet.address,
            facetCuts: facetCuts,
            income: {
                address: income.address,
                name: await income.name(),
                symbol: await income.symbol(),
                decimals: await income.decimals()
            },
            royaltyRecipient: custodian.address,
            royaltyBps: royaltyBps,
            baseUri: uri
        }, null, 2));

        const { events } = await common.prompt(async function() {
            return await Base.create(
                admin.address,
                diamondFacet.address,
                erc1155Facet.address,
                facetCuts,
                income.address,
                custodian.address,
                royaltyBps,
                uri
            );
        });
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned contract DeMineNFT at ' + cloned);
        return cloned;
    });

task('clone-demine-agent', 'Deploy clone of demine agent')
    .addOptionalParam('nft', 'contract address of DeMineNFT', undefined)
    .addParam('coin', 'Coin type')
    .addParam('cost', 'Cost per token')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        var nft = localNetworkConfig[args.coin].nft;
        var usd = localNetworkConfig.usd.wrapped;
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

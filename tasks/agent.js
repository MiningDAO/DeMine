const assert = require("assert");
const { types } = require("hardhat/config");
const common = require("../lib/common.js");

task('agent-clone', 'Deploy clone of demine agent')
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

        const diamondFacet = await common.getDeployment(hre, 'DiamondFacet');
        const mortgageFacet = await common.getDeployment(hre, 'MortgageFacet');
        const base = await common.getDeployment(hre, 'DeMineAgent');
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

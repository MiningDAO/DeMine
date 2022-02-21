const assert = require("assert");
const { types } = require("hardhat/config");
const config = require("../lib/config.js");
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const diamond = require("../lib/diamond.js");
const BN = require("bignumber.js");

task('agent-clone', 'Deploy clone of demine agent')
    .addParam('miningCoin', 'coin that NFT the agent is mining for')
    .addParam('paymentCoin', 'coin used for paying mining cost')
    .addParam('cost', 'Cost per NFT token in paymentToken')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        let costNum = BN.BigNumber(args.cost);
        if (isNaN(costNum)) {
            logger.warn("Invalid cost, which should be number.");
            return ethers.utils.getAddress( "0x0000000000000000000000000000000000000000");
        }
        logger.info("=========== MortgageFacet-clone start ===========");
        config.validateCoin(args.miningCoin);
        config.validatePaymentCoin(args.paymentCoin);

        const base = await config.getDeployment(hre, 'Diamond');
        const mortgageFacet = await config.getDeployment(hre, 'MortgageFacet');
        const contracts = state.tryLoadContracts(hre, args.miningCoin);
        if (
            contracts.mortgage &&
            contracts.mortgage.target &&
            contracts.mortgage.source == base.address &&
            contracts.mortgage.fallback == mortgageFacet.address
        ) {
            logger.warn("Nothing changed.");
            logger.info("=========== MortgageFacet-clone skipped ===========");
            return contracts.mortgage.target;
        }
        const nftAddr = (contracts.nft && contracts.nft.target)
            || await hre.run('nft-clone', { coin: args.miningCoin });
        const nftToken = await ethers.getContractAt('ERC1155Facet', nftAddr);

        const paymentTokenAddr = (contracts.payment && contracts.payment.target)
            || await hre.run('wrapped-clone', { coin: args.paymentCoin });
        const paymentToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            paymentTokenAddr
        );

        const admin = await config.admin(hre);
        const iface = new hre.ethers.utils.Interface([
            'function init(address nft, address paymentToken, address custodian, uint tokenCost, address[] calldata pricingStrategies, address[] calldata allowanceStrategies)'
        ]);
        // TODO: populate pricingStrategies and allowanceStrategies in init.
        const initArgs = [
            admin.address,
            await diamond.genInterfaces(
                hre,
                ['MortgageFacet']
            ),
            mortgageFacet.address,
            iface.encodeFunctionData('init', [nftAddr, paymentToken.address, nftToken.custodian(), costNum, [], []])
        ];

        logger.info('Cloning DeMine MortgageFacet: ' + JSON.stringify({
            network: network.name,
            source: base.address,
            owner: admin.address,
            fallback: mortgageFacet.address,
            fallbackInitArgs: {
                nft: nftAddr,
                custodian: nftToken.custodian(),
                paymentToken: paymentTokenAddr,
                tokenCost: costNum,
                pricingStrategies: [],
                allowanceStrategies: []
            }
        }, null, 2));
        const {cloned, txReceipt} = await common.clone(
            hre, admin.signer, base, initArgs,
        );
        logger.info('Cloned contract DeMine MortgageFacet at ' + cloned);
        logger.info('Writing contract info to state file');
        state.updateContract(
            hre, args.miningCoin, {
                'mortgageFacet': {
                    source: base.address,
                    target: cloned,
                    fallback: mortgageFacet.address,
                    txReceipt
                }
            }
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

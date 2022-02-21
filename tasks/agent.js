const assert = require("assert");
const { types } = require("hardhat/config");
const logger = require('../lib/logger.js');
const config = require("../lib/config.js");
const diamond = require("../lib/diamond.js");

task('agent-clone', 'Deploy clone of demine agent')
    .addParam('miningCoin', 'coin that NFT the agent is mining for')
    .addParam('paymentTokenAddr', 'contract address of token for paying mining cost')
    .addParam('cost', 'Cost per NFT token in paymentToken')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== MortgageFacet-clone start ===========");
        config.validatePaymentCoin(args.coin);

        const base = await config.getDeployment(hre, 'Diamond');
        const mortgageFacet = await config.getDeployment(hre, 'MortgageFacet');
        const contracts = state.tryLoadContracts(hre, args.coin);
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
        const nftToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC1155/IERC1155.sol:IERC1155',
            nftAddr
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
                ['@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol:IERC1155Receiver']
            ),
            mortgageFacet.address,
            iface.encodeFunctionData('init', [nftAddr, paymentTokenAddr, nftToken.custodian(), cost, [], []])
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
                tokenCost: cost,
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
            hre, args.coin, {
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

const assert = require("assert");
const { types } = require("hardhat/config");
const BN = require('bignumber.js');
const config = require("../lib/config.js");
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const diamond = require("../lib/diamond.js");
const ethers = require("ethers");

task('agent-clone', 'Deploy clone of demine agent')
    .addParam('coin', 'coin that NFT the agent is mining for')
    .addParam('cost', 'Cost per NFT token in usd')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        if (isNaN(args.cost)) {
            logger.warn("Invalid cost, which should be number.");
            return ethers.utils.getAddress( "0x0000000000000000000000000000000000000000");
        }
        logger.info("=========== MortgageFacet-clone start ===========");
        config.validateCoin(args.coin);

        const key = 'agent+' + args.cost;
        const base = await config.getDeployment(hre, 'Diamond');
        const mortgageFacet = await config.getDeployment(hre, 'MortgageFacet');
        const contracts = state.tryLoadContracts(hre, args.coin);
        if (
            contracts[key] &&
            contracts[key].target &&
            contracts[key].source == base.address &&
            contracts[key].fallback == mortgageFacet.address
        ) {
            logger.warn("Nothing changed.");
            logger.info("=========== MortgageFacet-clone skipped ===========");
            return contracts[key].target;
        }

        const nftAddr = (contracts.nft && contracts.nft.target)
            || await hre.run('nft-clone', { coin: args.coin });
        const nftToken = await ethers.getContractAt('ERC1155Facet', nftAddr);

        const paymentContract = state.tryLoadContracts(hre, 'usd');
        const paymentTokenAddr = localConfig.paymentToken[network.name]
            || (paymentContract.wrappedUSD && paymentContract.wrappedUSD.target)
            || await hre.run('wrapped-clone', { coin: 'usd' });
        const paymentToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            paymentTokenAddr
        );
        const decimals = await paymentToken.decimals();
        const normalizedCost = new BN(10).pow(decimals).times(args.cost);

        const admin = await config.admin(hre);
        const iface = new hre.ethers.utils.Interface([
            'function init(address, address, address, uint, address[], address[])'
        ]);

        const initArgs = [
            admin.address,
            await diamond.genInterfaces(
                hre,
                ['@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol:IERC1155Receiver']
            ),
            mortgageFacet.address,
            iface.encodeFunctionData(
                'init',
                [
                    nftAddr,
                    paymentTokenAddr,
                    admin.address,
                    ethers.BigNumber.from(normalizedCost.toFixed()),
                ]
            )
        ];
        logger.info('Cloning Mining3Agent: ' + JSON.stringify({
            network: network.name,
            source: base.address,
            owner: admin.address,
            fallback: mortgageFacet.address,
            fallbackInitArgs: {
                nft: nftAddr,
                paymentToken: paymentTokenAddr,
                custodian: admin.address,
                tokenCost: normalizedCost.toFixed(),
                tokenCostDecimal: args.cost,
                pricingStrategies: pricingStrategies,
                allowanceStrategies: allowanceStrategies,
            }
        }, null, 2));
        const {cloned, txReceipt} = await common.clone(
            hre, admin.signer, base, initArgs,
        );
        logger.info('Cloned contract DeMine MortgageFacet at ' + cloned);

        const agent = await ethers.getContractAt('Diamond', cloned);
        logger.info('Adding PrimaryMarketFacet');
        const pricingStatic = await hre.deployments.get('PricingStatic');
        const pricingLinearDecay = await hre.deployments.get('PricingLinearDecay');
        const pricingStrategies = {
            PricingStatic: pricingStatic.address,
            PricingLinearDecay: pricingLinearDecay.address,
        };
        const allowanceFixedOneTime = await hre.deployments.get('AllowanceFixedOneTime');
        const allowanceRangeOneTime = await hre.deployments.get('AllowanceRangeOneTime');
        const allowanceStrategies = {
            AllowanceFixedOneTime: allowanceFixedOneTime.address,
            AllowanceRangeOneTime: allowanceRangeOneTime.address,
        }
        const ifacePM = new hre.ethers.utils.Interface([
            'function batchRegisterStrategies(address[], address[])'
        ]);
        const calldata = ifacePM.encodeFunctionData(
            'batchRegisterStrategies',
            [
                Object.values(pricingStrategies),
                Object.values(allowanceStrategies)
            ]
        );
        const primaryMarketFacet = await config.getDeployment('PrimaryMarketFacet');
        await common.run(
            hre,
            admin,
            agent,
            'diamondCut',
            [
                [await genPrimaryMarketFacetCut(hre)],
                primaryMarketFacet.address,
                calldata
            ],
            {}
        );

        logger.info('Adding BillingFacet');
        const ifaceBilling = new hre.ethers.utils.Interface([
            'function setBillingMetadata(address, address, uint8, uint16)'
        ]);

        const chainlink = localConfig.chainlink[network.name][args.coin] ||
            await config.getDeployement(hre, 'ChainlinkMock');
        const swapRouter = localConfig.swapRouter[network.name] ||
            await config.getDeployement(hre, 'SwapRouterV2Mock');
        const billingCalldata = ifaceBilling.encodeFunctionData(
            'setBillingMetadata',
            [chainlink, swapRouter, 2, 10]
        );
        await common.run(
            hre,
            admin,
            agent,
            'diamondCut',
            [
                [await genBillingFacetCut(hre)],
                billingFacet.address,
                billingCalldata
            ],
            {}
        );

        logger.info('Writing contract info to state file');
        state.updateContract(
            hre, args.coin, {
                [key]: {
                    source: base.address,
                    target: cloned,
                    fallback: mortgageFacet.address,
                    txReceipt,
                }
            }
        );
        return cloned;
    });

async function genPrimaryMarketFacetCut(hre) {
    return await diamond.genFacetCut(hre, 'PrimaryMarketFacet', [
        [
            'PrimaryMarketFacet',
            [
                'setRoyaltyInfo',
                'royaltyInfo',
                'registerStrategy',
                'registeredStrategyType',
                'setStrategy',
                'getStrategy',
                'setAllowance',
                'claimFrom',
                'priceOfBatch',
                'allowanceOfBatch',
            ]
        ]
    ]);
}

async function genBillingFacetCut(hre) {
    return await diamond.genFacetCut(hre, 'BillingFacet', [
        [
            'BillingFacet',
            [
                'tryBilling',
                'purchaseEarningTokenToPayDebt',
                'discountInfo',
                'setDiscountInfo',
            ]
        ]
    ]);
}

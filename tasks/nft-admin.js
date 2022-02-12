const { types } = require("hardhat/config");
const BigNumber = require("bignumber.js");
const assert = require("assert");
const logger = require('../lib/logger');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const time = require("../lib/time.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");
const config = require("../lib/config.js");
const gnosis = require('../lib/gnosis.js');
const courier = require('../lib/courier.js');

const formatTs = function(ts) {
    return `${ts}(${new Date(ts * 1000).toISOString()})`;
}

async function getFinalizing(erc1155Facet, args) {
    const finalized = await erc1155Facet.finalized();
    logger.info(`Latest finalized is ${formatTs(finalized)}`);

    const finalizing = args.timestamp || finalized.add(86400).toNumber();
    logger.info(`Finalizing ${formatTs(finalizing)}`);
    if (finalizing % 86400 != 0) {
        throw `Error: timestamp to finalize should be start `
            + `of day, finalizing=${formatTs(finalizing)}`;
    }
    if (finalizing <= finalized) {
        throw `Error: already finalized, finalizing=`
            + `${formatTs(finalizing)}, finalized=${formatTs(finalized)}`;
    };
    const now = time.toEpoch(new Date());
    if (finalizing > now) {
        throw `Error: cannot finalize future tokens, finalizing=`
            + `${formatTs(finalizing)}, now=${formatTs(now)}`;
    }
    return finalizing;
}

async function getPoolStatsAndTokenRelease(hre, args, erc1155Facet, finalizing) {
    const poolStats = await antpool.stats(hre.localConfig.antpool, args.coin, finalizing);
    const hashPerToken = hre.localConfig.hashPerToken[args.coin];
    poolStats.hashrateDecimal = poolStats.hashrate.div(hashPerToken);
    logger.info('AntPool stats loaded: ' + JSON.stringify(poolStats, null, 2));

    const {released, supply} = await token.supplyOf(hre.ethers, erc1155Facet, finalizing);
    logger.info(`Token supply is ${supply} with ${released} released`);

    if (poolStats.hashrateDecimal.lt(released.toString())) {
        const errMsg = "Effective hashrate is lower than token released!"
        if (!args.enforce) {
            throw `Error: ${errMsg} poolStats=${poolStats},`
                + `released=${released.toString()}`;
        } else {
            logger.warn(errMsg);
        }
    }
    return {poolStats, released};
}

async function earning(admin, poolStats, released, earningToken) {
    const decimals = await earningToken.decimals();
    const base = new BigNumber(10).pow(decimals);
    const earningPerTokenDecimal = poolStats.totalEarned.div(
        poolStats.hashrateDecimal
    ).toFixed(decimals, 1);
    const earningPerToken = ethers.BigNumber.from(
        new BigNumber(earningPerTokenDecimal).times(base).integerValue().toString()
    );
    const totalEarningDecimal = new BigNumber(
        earningPerTokenDecimal
    ).times(released.toString());
    const totalEarning = earningPerToken.mul(released);

    logger.info('Earning summary: ' + JSON.stringify({
        earningPerToken: earningPerToken.toString(),
        totalEarning: totalEarning.toString(),
        totalEarnedDecimal: poolStats.totalEarned,
        totalEarningDecimal: totalEarningDecimal,
        amountToReserveDecimal: poolStats.totalEarned.minus(totalEarningDecimal),
        earningPerTokenDecimal: earningPerTokenDecimal,
    }, null, 2));

    const adminBalance = await earningToken.balanceOf(admin.address);
    const adminBalanceDecimal = new BigNumber(adminBalance.toString()).div(base);
    if (totalEarningDecimal.gt(adminBalanceDecimal.toString())) {
        throw `Error: Insufficient balance of admin to deposit` +
            `, required=${totalEarningAsDecimal}, balance=${adminBalanceDecimal}`
    }
    return {
        earningPerToken,
        earningPerTokenDecimal,
        totalEarning,
        totalEarningDecimal,
    };
}

task('nft-admin-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam(
        'timestamp',
        'all tokens ends before timestamp will be finalized',
        undefined,
        types.int
    )
    .addOptionalParam('nft', 'nft contract address')
    .addFlag('enforce', 'enforce to set even the hashrate is smaller than supply')
    .setAction(async (args, { ethers, localConfig } = hre) => {
        logger.info("=========== nft-admin-finalize start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        logger.info(`NFT contract ${nft} loaded`);

        const earningToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );
        logger.info(`Reward token ${earningToken.address} loaded`);

        const finalizing = await getFinalizing(erc1155Facet, args);
        const {poolStats, released} = await getPoolStatsAndTokenRelease(
            hre, args, erc1155Facet, finalizing
        );
        const {
            earningPerToken,
            earningPerTokenDecimal,
            totalEarning,
            totalEarningDecimal,
        } = await earning(admin, poolStats, released, earningToken);

        logger.info('Will finalize with args: ' + JSON.stringify({
            timestamp: formatTs(finalizing),
            tokenValue: earningPerToken.toString(),
            withdrawFrom: admin.address,
            totalEarning: totalEarning.toString()
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'finalize',
                [
                    finalizing,
                    earningPerToken,
                    admin.address,
                    totalEarning
                ]
            );
            const safe = await gnosis.getSafe(hre, admin);
            const request = await gnosis.propose(
                hre, safe, erc1155Facet.address, calldata
            );
            await courier.notifyGnosis(
                hre,
                args.coin,
                request,
                {
                    operation: 'finalizeNFT',
                    functionToCall: 'finalize',
                    finalizing,
                    finalizingAsDate: formatTs(finalizing),
                    earningPerToken,
                    earningPerTokenDecimal,
                    totalEarning,
                    totalEarningDecimal,
                    withdrawFrom: admin.address,
                },
                {
                    [earningToken.address]: await earningToken.symbol(),
                    [nft]: 'DeMineNFT',
                    [admin.address]: 'DeMineAdmin(Gnosis Safe)',
                    [admin.signer.address]: 'DeMineAdmin(EOA)',
                }
            );
        } else {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).finalize(
                    finalizing,
                    earningPerToken,
                    admin.address,
                    totalEarning,
                );
            });
        }
        logger.info("=========== nft-admin-finalize End ===========");
    });

task('nft-admin-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('ids', 'token id list, separated by comma')
    .addParam('amounts', 'amount per token, separated by comma')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, deployments } = hre) => {
        logger.info("=========== nft-admin-mint start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = args.ids.split(',').map(i => ethers.BigNumber.from(i));
        const amounts = args.amounts.split(',').map(a => parseInt(a));

        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);

        logger.info('Will mint nft with following info:' + JSON.stringify({
            address: nft,
            operator: admin.address,
            numTokenTypes: ids.length,
            idsAsDate: token.readableIds(ids),
            ids: ids.map(i => i.toString()).join(','),
            amounts: args.amounts
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'mint',
                [ids, amounts, []]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc1155Facet.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).mint(ids, amounts, []);
            });
        }
        logger.info("=========== nft-admin-mint end ===========");
    });

task('nft-admin-release', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('ids', 'token id list, separated by comma')
    .addParam('amounts', 'amount per token, separated by comma')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, deployments } = hre) => {
        logger.info("=========== nft-admin-release start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = args.ids.split(',').map(i => ethers.BigNumber.from(i));
        const amounts = args.amounts.split(',').map(a => parseInt(a));

        const to = ethers.utils.getAddress(args.to);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        logger.info('Will release nft with following info: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            from: custodian.address,
            to: to,
            numTokenTypes: ids.length,
            idsAsDate: token.readableIds(ids),
            ids: ids.map(t => t.toString()).join(','),
            amount: args.amounts
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'safeBatchTransferFrom',
                [custodian.address, to, ids, amounts, []]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc1155Facet.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).safeBatchTransferFrom(
                    custodian.address, to, ids, amounts, []
                )
            });
        }
        logger.info("=========== nft-admin-release end ===========");
    });

task('nft-admin-seturi', 'set uri for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-seturi start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const uri = token.uri(hre, args.coin);

        logger.info('Will set uri: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            currentUri: await erc1155Facet.uri(0),
            newUri: uri
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'setURI', [uri]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc1155Facet.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(admin.signer).setURI(uri);
            });
        }
        logger.info("=========== nft-admin-seturi end ===========");
    });

task('nft-admin-setfallback', 'set fallback address for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('fallback', 'fallback to set')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-setfallback start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const diamond = await ethers.getContractAt('Diamond', nft);
        const curFallback = await diamond.getFallbackAddress();

        const erc1155Facet = await config.getDeployment(hre, 'ERC1155Facet');
        const fallback = ethers.getAddress(args.fallback) || erc1155Facet.address;
        if (fallback != curFallback) {
            logger.warn('fallback address not changed');
        }

        logger.info('Will set fallback address: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            currentFallback: curFallback,
            newFallback: fallback
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'setFallbackAddress', [fallback]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc1155Facet.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).setFallbackAddress(fallback);
            });
        }
        logger.info("=========== nft-admin-setfallback end ===========");
    });

task('nft-admin-custody', 'approve admin for custodian contract at nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-custody start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        logger.info('Setting up custody: ' + JSON.stringify({
            nft: nft,
            admin: admin.address,
            approved: true
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = custodian.interface.encodeFunctionData(
                'custody',
                [nft, admin.address, true]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, custodian.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await custodian.connect(
                    admin.signer
                ).custody(nft, admin.address, true)
            });
        }
        logger.info("=========== nft-admin-custody end ===========");
    });

task('nft-admin-setallowance', 'set allownace of admin for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('allowance', 'allowance to set, decimal')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-setallowance start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const earningToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );

        const decimals = await earningToken.decimals();
        const base = new BigNumber(10).pow(decimals);
        const normalized = base.times(args.allowance);
        const allowance = ethers.BigNumber.from(normalized.integerValue().toString());
        logger.info('Setting allowance: ' + JSON.stringify({
            contract: earningToken.address,
            owner: admin.address,
            spender: nft,
            allowance: allowance.toString()
        }, null, 2));

        if (admin.type == 'GNOSIS') {
            const calldata = earningToken.interface.encodeFunctionData(
                'approve', [nft, allowance]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(
                hre, safe, earningToken.address, calldata
            );
        } else {
            await common.run(hre, async function() {
                return await earningToken.connect(
                    admin.signer
                ).approve(nft, allowance);
            });
        }
        logger.info("=========== nft-admin-setallowance end ===========");
    });

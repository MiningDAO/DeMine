const { types } = require("hardhat/config");
const BN = require("bignumber.js");
const assert = require("assert");
const logger = require('../lib/logger');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const time = require("../lib/time.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");
const config = require("../lib/config.js");
const lodash = require('lodash');

const formatTs = function(ts) {
    return `${ts}(${new Date(ts * 1000).toISOString()})`;
}

async function getFinalizing(erc1155, args) {
    const finalized = new BN((await erc1155.finalized()).toString());
    const finalizedAsDate = new Date(finalized * 1000).toISOString();
    logger.info(`Latest finalized is ${formatTs(finalized)}`);

    const finalizing = args.timestamp || finalized.plus(86400).toNumber();
    const finalizingAsDate = new Date(finalizing * 1000).toISOString();
    logger.info(`Finalizing ${formatTs(finalizing)}`);

    const errMsg = `finalizing=${finalizing}(${finalizingAsDate})` +
        `finalized=${finalized}(${finalizedAsDate})`;
    if (finalizing % 86400 != 0) {
        throw `Error: finalizing should be start of day, ${errMsg}`;
    }
    if (finalizing <= finalized) {
        throw `Error: already finalized, ${errMsg}`;
    };
    const now = time.toEpoch(new Date());
    const nowAsDate = new Date(now * 1000).toISOString();
    if (finalizing > now) {
        throw `Error: cannot finalize future tokens, ` +
            `now=${now}(${nowAsDate}), ${errMsg}`;
    }
    return {
        finalizing,
        finalizingAsDate,
        finalized,
        finalizedAsDate,
        finalizingAt: now,
        finalizingAtAsDate: nowAsDate,
    };
}

async function getPoolStatsAndTokenRelease(hre, args, erc1155, context) {
    const { finalizing } = context;
    const poolStats = await antpool.stats(
        hre.localConfig.antpool, args.coin, finalizing
    );
    const hashPerToken = hre.localConfig.hashPerToken[args.coin];
    poolStats.hashrateDecimal = poolStats.hashrate.div(hashPerToken);
    logger.info('AntPool stats loaded: ' + JSON.stringify(poolStats, null, 2));

    const tokenizedHashrate = await token.tokenizedHashrate(erc1155, finalizing);
    logger.info(`Tokenized hashrate is ${tokenizedHashrate}`);

    if (poolStats.hashrateDecimal.lt(tokenizedHashrate)) {
        const errMsg = "Effective hashrate is lower than token released!"
        if (!args.enforce) {
            throw `Error: ${errMsg} Real Hashrate is ${poolStats.hashrateDecimal.toString()},`
                + `tokenized Hashrate is ${tokenizedHashrate.toString()}`;
        } else {
            logger.warn(errMsg);
        }
    }
    return {
        tokenizedHashrate,
        ...poolStats
    };
}

async function earning(admin, earningToken, context) {
    const {tokenizedHashrate, totalEarnedDecimal, hashrateDecimal} = context;
    const base = new BN(10).pow(await earningToken.decimals());
    const earningPerTokenDecimal = totalEarnedDecimal.div(hashrateDecimal);
    const earningPerToken = earningPerTokenDecimal.times(base).integerValue();

    const amountToDeposit = earningPerToken.times(tokenizedHashrate);
    const amountToDepositDecimal = earningPerTokenDecimal.times(tokenizedHashrate);

    const adminBalance = await earningToken.balanceOf(admin.address);
    const adminBalanceDecimal = new BN(adminBalance.toString()).div(base);
    if (amountToDepositDecimal.gt(adminBalanceDecimal)) {
        throw `Error: Insufficient balance of admin to deposit` +
            `, required=${totalEarningAsDecimal}, balance=${adminBalanceDecimal}`
    }
    return {
        earningPerToken,
        earningPerTokenDecimal,
        amountToDeposit,
        amountToDepositDecimal,
        amountToReserveDecimal: totalEarnedDecimal.minus(amountToDepositDecimal),
    };
}

async function genAppendix(admin, erc1155, earningToken) {
    var appendix = {
        [admin.signer.address]: 'DeMineAdmin(External Account)',
        [erc1155.address]: 'DeMineNFT Contract',
    };
    if (earningToken) {
        const symbol = await earningToken.symbol();
        appendix = lodash.merge(appendix, {
            [earningToken.address]: `${symbol}(EarningToken)`,
        });
    }
    if (admin.type == 'GNOSIS') {
        return {
            [admin.address]: 'DeMineAdmin(Gnosis Safe)',
            ...appendix
        }
    } else {
        return appendix;
    }
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
    .addFlag('dryrun', 'do not run but just simulate the process')
    .addFlag('enforce', 'enforce to set even the hashrate is smaller than supply')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-finalize start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
        logger.info(`NFT contract ${nft} loaded`);

        const earningToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155.earningToken()
        );
        logger.info(`Reward token ${earningToken.address} loaded`);

        var context = await getFinalizing(erc1155, args);
        lodash.merge(context, await getPoolStatsAndTokenRelease(
            hre, args, erc1155, context
        ));
        lodash.merge(context, await earning(admin, earningToken, context));
        lodash.merge(context, await genAppendix(admin, erc1155, earningToken));

        logger.info('Report: ' + JSON.stringify(context, null, 2));
        const {request, response} = await common.run(
            hre,
            admin,
            erc1155,
            'finalize',
            [
                ["timestamp", context.finalizing.toString()],
                ["earningPerToken", context.earningPerToken],
                ["withdrawFrom", admin.address],
                ["amountToDeposit", context.amountToDeposit],
            ],
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-finalize End ===========");
        return {request, context, response,};
    });

task('nft-admin-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('ids', 'token id list, separated by comma')
    .addParam('amounts', 'amount per token, separated by comma')
    .addOptionalParam('nft', 'nft contract address')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-mint start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = args.ids.split(',').map(i => new BN(i));
        const amounts = args.amounts.split(',').map(a => new BN(a));

        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);

        logger.info('Will mint nft with following info:' + JSON.stringify({
            address: nft,
            operator: admin.address,
            numTokenTypes: ids.length,
            idsAsDate: token.readableIds(ids),
            ids: ids.map(i => i.toString()).join(','),
            amounts: args.amounts
        }, null, 2));
        const result = await common.run(
            hre,
            admin,
            erc1155,
            'mint',
            [
                ["ids", ids],
                ["amounts", amounts],
                ["data", []],
            ],
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-mint end ===========");
        return result;
    });

task('nft-admin-release', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('ids', 'token id list, separated by comma')
    .addParam('amounts', 'amount per token, separated by comma')
    .addOptionalParam('nft', 'nft contract address')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-release start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = args.ids.split(',').map(i => new BN(i));
        const amounts = args.amounts.split(',').map(a => new BN(a));

        const to = ethers.utils.getAddress(args.to);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        logger.info('Will release nft with following info: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            from: custodian.address,
            to: to,
            numTokenTypes: ids.length,
            idsAsDate: token.readableIds(ids),
            ids: ids.map(t => t.toFixed()).join(','),
            amount: args.amounts
        }, null, 2));
        const params = [
            ["from", custodian.address],
            ["to", to],
            ["ids", ids],
            ["amounts", amounts],
            ["data", []],
        ];
        const result = await common.run(
            hre,
            admin,
            erc1155,
            'safeBatchTransferFrom',
            params,
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-release end ===========");
        return result;
    });

task('nft-admin-seturi', 'set uri for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-seturi start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
        const uri = token.uri(hre, args.coin);

        logger.info('Will set uri: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            currentUri: await erc1155.uri(0),
            newUri: uri
        }, null, 2));

        const result = await common.run(
            hre,
            admin,
            erc1155,
            'setURI',
            [["uri", uri]],
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-seturi end ===========");
        return result;
    });

task('nft-admin-setfallback', 'set fallback address for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .addOptionalParam('fallback', 'fallback to set')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-setfallback start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const diamond = await ethers.getContractAt('Diamond', nft);
        const curFallback = await diamond.getFallbackAddress();

        const erc1155 = await config.getDeployment(hre, 'ERC1155Facet');
        const fallback = ethers.getAddress(args.fallback) || erc1155.address;
        if (fallback != curFallback) {
            logger.warn('fallback address not changed');
        }

        logger.info('Will set fallback address: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            currentFallback: curFallback,
            newFallback: fallback
        }, null, 2));
        const result = await common.run(
            hre,
            admin,
            erc1155,
            'setFallbackAddress',
            [["fallbackAddress", fallback]],
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-setfallback end ===========");
        return result;
    });

task('nft-admin-custody', 'approve admin for custodian contract at nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('dryrun', 'do not run but just simulate the process')
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
        const result = await common.run(
            hre,
            admin,
            custodian,
            'custody',
            [
                ["nftContractAddress", nft],
                ["spender", admin.address],
                ["approved", true],
            ],
            {dryrun: args.dryrun},
        );
        logger.info("=========== nft-admin-custody end ===========");
        return result;
    });

task('nft-admin-setallowance', 'set allownace of admin for nft contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('allowance', 'allowance to set, decimal')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-setallowance start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
        const earningToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155.earningToken()
        );

        const decimals = await earningToken.decimals();
        const allowanceDecimal = new BN(args.allowance).toFixed(decimals);
        const expBase = new BN(10).pow(decimals);
        const allowance = expBase.times(allowanceDecimal).integerValue();
        logger.info('Setting allowance: ' + JSON.stringify({
            contract: earningToken.address,
            owner: admin.address,
            spender: nft,
            allowance,
            allowanceDecimal
        }, null, 2));
        const result = await common.run(
            hre,
            admin,
            earningToken,
            'approve',
            [
                ["nftContractAddress", nft]
                ["allowance", allowance],
            ],
            {dryrun: args.dryrun},
        );
        logger.info("=========== nft-admin-setallowance end ===========");
        return result;
    });

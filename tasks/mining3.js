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

// 1 days ago so you can finalize yesterday
const DEFAULT_SNAPSHOT = time.startOfDay(new Date());

const formatTs = function(ts) {
    return `${ts}(${new Date(ts * 1000).toISOString()})`;
}

async function loadEarningToken(hre, coin) {
    const earningTokenConfig = localConfig.earningToken[hre.network.name] || {};
    const contracts = state.tryLoadContracts(hre, coin);
    const key = 'wrapped' + coin.toUpperCase();
    const wrapped = contracts[key] || contracts.wrapped;
    const earningTokenAddr = earningTokenConfig[coin.toLowerCase()]
        || (wrapped && wrapped.target)
        || await hre.run('wrapped-clone', { coin: coin });
    return await ethers.getContractAt(
        '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata',
        earningTokenAddr
    );
}

async function getFinalizing(mining3, args) {
    const finalized = new BN((await mining3.lastFinalizedAt()).toString());
    const finalizedAsDate = new Date(finalized * 1000).toISOString();
    logger.info(`Latest finalized is ${formatTs(finalized)}`);

    const finalizing = finalized.plus(86400).toNumber();
    const finalizingAsDate = new Date(finalizing * 1000).toISOString();
    logger.info(`Finalizing ${formatTs(finalizing)}`);

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

async function getPoolStatsAndTokenRelease(hre, args, mining3, context) {
    const { finalizing } = context;
    const poolStats = await antpool.stats(
        hre.localConfig.antpool, args.coin, finalizing
    );
    const hashPerToken = hre.localConfig.hashPerToken[args.coin];
    poolStats.hashrateDecimal = poolStats.hashrate.div(hashPerToken);
    logger.info('AntPool stats loaded: ' + JSON.stringify(poolStats, null, 2));

    const tokenizedHashrate = await mining3.totalSupplyAt(finalizing);
    logger.info(`Tokenized hashrate is ${tokenizedHashrate}`);

    if (poolStats.hashrateDecimal.lt(tokenizedHashrate)) {
        const errMsg = "Effective hashrate is lower than token released!"
        if (!args.nosupplycheck) {
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

async function genAppendix(admin, mining3, earningToken) {
    var appendix = {
        [admin.signer.address]: 'DeMineAdmin(External Account)',
        [mining3.address]: 'Mining3 Contract',
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

task('mining3-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'earning token symbol')
    .addOptionalParam('mining3', 'mining3 contract address')
    .addFlag('nosupplycheck', 'do not check supply with hashrate online')
    .addFlag('dryrun', 'do not run but just simulate the process')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-finalize start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const mining3Addr = args.mining3 || state.loadMining3(hre, args.coin).address;
        const mining3 = await ethers.getContractAt('Mining3', mining3Addr);
        logger.info(`Mining3 contract ${mining3Addr} loaded`);

        const earningToken = await ethers.getContractAt(
            '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
            await mining3.earningToken()
        );
        logger.info(`Earning token ${earningToken.address} loaded`);

        var context = await getFinalizing(mining, args);
        lodash.merge(context, await getPoolStatsAndTokenRelease(
            hre, args, mining3, context
        ));
        lodash.merge(context, await earning(admin, earningToken, context));
        lodash.merge(context, await genAppendix(admin, mining3, earningToken));

        logger.info('Report: ' + JSON.stringify(context, null, 2));
        const {request, response} = await common.run(
            hre,
            admin,
            mining3, 'finalize',
            [["earningPerToken", context.earningPerToken]],
            {dryrun: args.dryrun}
        );
        logger.info("=========== nft-admin-finalize End ===========");
        return {request, context, response,};
    });

task('mining3-clone', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'earning token symbol')
    .setAction(async (args, { ethers } = hre) => {
        logger.info("=========== nft-admin-finalize start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const mining3 = await config.getDeployment(hre, 'Mining3');
        const beacon = await config.getDeployment(hre, 'UpgradeableBeacon');
        const proxy = await config.getDeployment(hre, 'Mining3Proxy');

        const name = 'Mining3 token for ' + args.coin.toUpperCase();
        const symbol = 'm3' + args.coin.toUpperCase();
        const earningToken = await loadEarningToken(hre, args.coin);

        logger.info('Cloning Mining3: ' + JSON.stringify({
            source: proxy.address,
            beacon: beacon.address,
            implementation: await beacon.implementation(),
            startSnapshotId: formatTs(DEFAULT_SNAPSHOT),
            owner: admin.address,
            metadata: {
                name,
                symbol,
                decimals: 18
            },
            earningToken: {
                address: earningToken.address,
                name: await earningToken.name(),
                symbol: await earningToken.symbol(),
                decimals: await earningToken.decimals()
            },
        }, null, 2));
        const populatedTx = await proxy.connect(
           admin.signer
        ).populateTransaction.clone(
            name,
            symbol,
            earningToken.address,
            DEFAULT_SNAPSHOT,
            admin.address
        );
        const txReceipt = await common.execTx(
            hre,
            admin.signer,
            populatedTx
        );
        const events = common.getTransactionEvents(
            [proxy, mining3],
            txReceipt
        );
        const cloned = events['Clone'].args.cloned;
        logger.info('Writing contract info to state file');
        state.updateContract(
            hre, args.coin, {
                'mining3': {
                    source: proxy.address,
                    target: cloned,
                    beacon: beacon.address,
                    txReceipt
                }
            }
        );
        logger.info("=========== nft-clone end ===========");
        return cloned;
    });

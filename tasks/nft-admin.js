const { types } = require("hardhat/config");
const BigNumber = require("bignumber.js");
const assert = require("assert");
const nft = require("../lib/nft.js");
const logger = require('../lib/logger');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const time = require("../lib/time.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");
const config = require("../lib/config.js");

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
    .setAction(async (args, { ethers, network } = hre) => {
        logger.info("=========== nft-admin-finalize start ===========");
        config.validateCoin(args.coin);

        // step1: withdraw balance to admin
        const admin = await config.admin(hre);
        if (hre.network.name == 'bsc') {
            logger.info("Will withdraw balance from binance to admin");
            await binance.withdrawAll(hre, args.coin, admin.address);
        }

        // step2: finalize
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        logger.info(`NFT contract ${nft} loaded`);
        const rewardToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );
        logger.info(`Reward token ${rewardToken.address} loaded`);

        const formatTs = function(ts) {
            return `${ts}(${new Date(ts * 1000).toISOString()})`;
        }
        const finalized = await erc1155Facet.finalized();
        logger.info(`Latest finalized is ${formatTs(finalized)}`);

        const finalizing = args.timestamp || finalized.add(86400).toNumber();
        logger.info(`Finalizing ${formatTs(finalizing)}`);
        assert(
            finalizing % 86400 == 0,
            `Error: timestamp to finalize should be start of day`
        );
        assert(finalizing > finalized, `Error: already finalized`);
        const now = time.toEpoch(new Date());
        assert(finalizing < now, `Error: cannot finalize future tokens`);

        const poolStats = (finalizing == time.startOfDay(new Date()))
            ? await antpool.statsYesterday(localConfig.antpool, args.coin)
            : await antpool.stats(localConfig.antpool, args.coin, finalizing);
        const hashPerToken = localConfig.hashPerToken[args.coin.toLowerCase()];
        poolStats.canonicalizedHashrate = poolStats.hashrate.div(hashPerToken);
        logger.info('AntPool stats loaded: ' + JSON.stringify(poolStats, null, 2));

        const supply = await token.supplyOf(hre.ethers, erc1155Facet, finalizing);
        logger.info(`Token supply is ${supply}`);
        if (poolStats.canonicalizedHashrate.lt(supply.toString())) {
            const errMsg = "Effective hashrate is lower than token supply!"
            assert(args.enforce, "Error: " + errMsg);
            logger.warn(errMsg);
        }

        const decimals = await rewardToken.decimals();
        const base = new BigNumber(10).pow(decimals);

        const tokenValue = poolStats.totalEarned.div(
            poolStats.canonicalizedHashrate
        ).toFixed(decimals, 1);
        const canonicalizedTokenValue = ethers.BigNumber.from(
            new BigNumber(tokenValue).times(base).integerValue().toString()
        );

        const amountToDeposit = new BigNumber(tokenValue).times(supply.toString());
        const canonicalizedAmountToDeposit = canonicalizedTokenValue.mul(supply);
        const canonicalizedAdminBalance = await rewardToken.balanceOf(admin.address);
        const adminBalance = new BigNumber(canonicalizedAdminBalance.toString()).div(base);
        assert(
            amountToDeposit.lte(adminBalance.toString()),
            'Error: Insufficient balance from admin'
        );

        logger.info('Summary: ' + JSON.stringify({
            address: nft,
            operator: admin.address,
            finalized: formatTs(finalized.toNumber()),
            antpool: poolStats,
            earning: {
                totalEarned: poolStats.totalEarned,
                amountToDeposit: amountToDeposit,
                'amountToDeposit(canonicalized)': canonicalizedAmountToDeposit.toString(),
                amountToReserve: poolStats.totalEarned.minus(amountToDeposit)
            },
            finalizing: {
                timestamp: formatTs(finalizing),
                tokenValue: tokenValue.toString,
                'tokenValue(canonicalized)': canonicalizedTokenValue.toString(),
                supply: supply.toString()
            },
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).finalize(
                    finalizing,
                    canonicalizedTokenValue,
                    admin.address,
                    canonicalizedAmountToDeposit
                );
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'finalize',
                [
                    finalizing,
                    canonicalizedTokenValue,
                    admin.address,
                    canonicalizedAmountToDeposit
                ]
            );
            logger.info('Not signer, calling info:' + JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
        logger.info("=========== nft-admin-finalize End ===========");
    });

task('nft-admin-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .addParam('amount', 'amount per token', undefined, types.int)
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        logger.info("=========== nft-admin-mint start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = token.parseTokenIds(args.tokens);
        const encodedIds = token.encode(ethers, ids);
        const amounts = Array(ids.length).fill(args.amount);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);

        logger.info('Will mint nft with following info:' + JSON.stringify({
            address: nft,
            operator: admin.address,
            numTokenTypes: ids.length,
            amountPerToken: args.amount,
            idsAsDate: token.readableIds(ids),
            ids: encodedIds.map(t => t.toHexString()),
            amounts: amounts.join(',')
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).mint(encodedIds, amounts, []);
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'mint',
                [encodedIds, amounts, []]
            );
            logger.info('Not signer, calling info: ' + JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
        logger.info("=========== nft-admin-mint end ===========");
    });

task('nft-admin-release', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .addParam('amount', 'amount to release per token', undefined, types.int)
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        logger.info("=========== nft-admin-release start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const ids = token.parseTokenIds(args.tokens);
        const encodedIds = token.encode(ethers, ids);
        const amounts = Array(ids.length).fill(args.amount);
        const to = ethers.utils.getAddress(args.to);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        logger.info('Will release nft with following info: ' + JSON.stringify({
            contract: nft,
            operator: admin.address,
            from: custodian.address,
            to: to,
            amountPerToken: args.amount,
            numTokenTypes: ids.length,
            idsAsDate: token.readableIds(ids),
            ids: encodedIds.map(t => t.toHexString()),
            amount: amounts.join(',')
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).safeBatchTransferFrom(
                    custodian.address, to, encodedIds, amounts, []
                )
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'safeBatchTransferFrom',
                [custodian.address, to, encodedIds, amounts, []]
            );
            logger.info('Not signer, calling info: ' + JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
        logger.info("=========== nft-admin-release end ===========");
    });

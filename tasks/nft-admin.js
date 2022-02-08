const nft = require("../lib/nft.js");
const logger = require('../lib/logger');
const { types } = require("hardhat/config");
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");
const nftLib = require("../lib/nft.js");

task('nft-admin-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('date', 'Date to finalize, format: YYYY-MM-DD')
    .addFlag('enforce', 'enforce to set even the hashrate is smaller than supply')
    .setAction(async (args, { ethers, network } = hre) => {
        nftLib.validateCommon(args, hre);
        assert(args.date && time.validateDate(args.date), 'invalid date');

        // step1: withdraw balance to admin
        logger.info("Step1: Withdraw balance from binance to admin");
        const admin = config.admin(hre);
        if (hre.network.name == 'bsc') {
            await binance.withdrawAll(hre, args.coin, admin.address);
        }

        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        logger.info(`NFT ${nft.target} loaded`);
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

        const finalizing = args.date
            ? time.toEpoch(new Date(args.date)) + 86400
            : finalized + 86400; // move timestamp to end of day
        logger.info(`Finalizing ${formatTs(finalizing)}`);
        assert(finalizing > finalized, `Error: already finalized`);
        const now = time.toEpoch(new Date());
        assert(finalizing < now, `Error: cannot finalize future tokens`);

        const poolStats = (finalizing == time.startOfDay(new Date()))
            ? await antpool.statsYesterday(localConfig.antpool, args.coin)
            : await antpool.stats(localConfig.antpool, args.coin, finalizing);
        const hashPerToken = localConfig.hashPerToken[args.coin.toLowerCase()];
        poolStats.hashrate = poolStats.hashrate.div(hashPerToken);
        logger.info(`AntPool stats loaded: ${JSON.stringify(poolStats)}`);

        const supply = await token.supplyOf(hre.ethers, erc1155Facet, finalizing);
        logger.info(`Hashrate supply is ${supply}`);
        if (hashrate.lt(supply.toString())) {
            const errMsg = "Effective hashrate is lower than token supply!"
            assert(args.enforce, "Error: " + errMsg);
            logger.warn(errMsg);
        }

        const decimals = await rewardToken.decimals();
        const tokenValue = poolStats.totalEarned.div(hashrate).toFixed(decimals, 1);

        const base = new BigNumber(10).pow(decimals);
        const canonicalizedTokenValue = ethers.BigNumber.from(
            new BigNumber(tokenValue).times(base).integerValue().toString()
        );
        const amountToDeposit = tokenValue.mul(supply.toString());
        const adminBalance = new BigNumber(
            (await rewardToken.balanceOf(admin.address)).toString()
        ).div(base);
        assert(
            amountToDeposit.lte(adminBalance.toString()),
            'Error: Insufficient balance from admin'
        );

        logger.info('Summary: ');
        logger.info(JSON.stringify({
            address: nft.target,
            operator: admin.address,
            finalized: formatTs(finalized.toNumber()),
            antpool: poolStats,
            financial: {
                totalEarned: poolStats.totalEarned,
                amountToDeposit: amountToDeposit.div(base),
                amountToReserve: totalEarned.minus(amountToDeposit)
            },
            finalizing: {
                timestamp: formatTs(finalizing),
                tokenValue: tokenValue,
                'tokenValue(canonicalized)': canonicalizedTokenValue,
                supply: supply.toString()
            },
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).finalize(finalizing, tokenValue);
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'finalize',
                [finalizing, canonicalizedTokenValue, supply]
            );
            logger.info('Not signer, call with following calldata');
            logger.info(JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
    });

task('nft-admin-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .addParam('amount', 'amount per token', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        nftLib.validateCommon(args, hre);

        const admin = await config.admin(hre);
        const ids = nftLib.parseTokenIds(args.tokens);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);

        var amounts = [];
        for (let i = 0; i < ids.length; i++) {
            amounts.push(args.amount);
        }
        const encodedIds = token.encode(ethers, ids);
        logger.info('Will mint nft with following info:');
        logger.info(JSON.stringify({
            address: nft.target,
            operator: admin.address,
            numTokenTypes: ids.length,
            amountPerToken: args.amount,
            idsAsDate: token.readableIds(ids),
            ids: encodeIds.map(t => t.toHexString()),
            amounts: amounts.join(',')
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.mint(
                    admin.signer
                ).mint(encodedIds, amounts, []);
            });
        } else {
            logger.info('Not signer, please call manually with following info');
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'mint',
                [encodedIds, amounts, []]
            );
            logger.info(JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
    });

task('nft-admin-release', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .addParam('amounts', 'amount to transfer')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        nftLib.validateCommon(args, hre);

        const admin = config.admin(hre);
        const ids = nftLib.parseTokenIds(args.tokens);
        const to = ethers.utils.getAddress(args.to);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const amounts = args.amounts.split(',').map(i => parseInt(i));
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        const info = {
            contract: nft.target,
            operator: admin.address,
            from: custodian.address,
            to: to,
            numTokenTypes: ids.length,
            id: ids.map(id => id.startDate.split('T')[0]).join(','),
            amount: amounts.join(',')
        };
        logger.info('Will transfer nft with following info:');
        logger.info(JSON.stringify(info, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).safeBatchTransferFrom(
                    custodian.address, to, token.encode(ethers, ids), amounts, []
                )
            });
        } else {
            logger.info('Not signer, please call manually with following info');
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'safeBatchTransferFrom',
                [custodian.address, to, token.encode(ethers, ids), amounts, []]
            );
            logger.info(JSON.stringify({
                operator: admin.address,
                contract: erc1155Facet.address,
                calldata
            }, null, 2));
        }
    });

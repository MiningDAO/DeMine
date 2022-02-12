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

task('binance-withdraw', 'withdraw fund from binance to admin account')
    .addParam('coin', 'Coin of DeMineNFT')
    .setAction(async (args, { ethers, network } = hre) => {
        const admin = await config.admin(hre);
        if (hre.network.name == 'bsc') {
            logger.info("Will withdraw balance from binance to admin");
            await binance.withdrawAll(hre, args.coin, admin.address);
        }
    });

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

        const poolStats = await antpool.stats(localConfig.antpool, args.coin, finalizing);
        const hashPerToken = localConfig.hashPerToken[args.coin.toLowerCase()];
        poolStats.canonicalizedHashrate = poolStats.hashrate.div(hashPerToken);
        logger.info('AntPool stats loaded: ' + JSON.stringify(poolStats, null, 2));

        const {released, supply} = await token.supplyOf(hre.ethers, erc1155Facet, finalizing);
        logger.info(`Token supply is ${supply} with ${released} released`);
        if (poolStats.canonicalizedHashrate.lt(released.toString())) {
            const errMsg = "Effective hashrate is lower than released!"
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

        const amountToDeposit = new BigNumber(tokenValue).times(released.toString());
        const canonicalizedAmountToDeposit = canonicalizedTokenValue.mul(released);
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
                released: released.toString()
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
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, erc1155Facet.address, calldata);
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

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).mint(ids, amounts, []);
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'mint',
                [ids, amounts, []]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, erc1155Facet.address, calldata);
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

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).safeBatchTransferFrom(
                    custodian.address, to, ids, amounts, []
                )
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'safeBatchTransferFrom',
                [custodian.address, to, ids, amounts, []]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, erc1155Facet.address, calldata);
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

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(admin.signer).setURI(uri);
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'setURI', [uri]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, erc1155Facet.address, calldata);
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

        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc1155Facet.connect(
                    admin.signer
                ).setFallbackAddress(fallback);
            });
        } else {
            const calldata = erc1155Facet.interface.encodeFunctionData(
                'setFallbackAddress', [fallback]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, erc1155Facet.address, calldata);
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

        if (admin.signer) {
            await common.run(hre, async function() {
                return await custodian.connect(
                    admin.signer
                ).custody(nft, admin.address, true)
            });
            logger.info('Custody setup done');
        } else {
            const calldata = custodian.interface.encodeFunctionData(
                'custody',
                [nft, admin.address, true]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, custodian.address, calldata);
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
        const normalized = new BigNumber(10).pow(decimals).times(args.allowance);
        const allowance = ethers.BigNumber.from(normalized.integerValue().toString());
        logger.info('Setting allowance: ' + JSON.stringify({
            contract: earningToken.address,
            owner: admin.address,
            spender: nft,
            allowance: allowance.toString()
        }, null, 2));

        if (admin.signer) {
            await common.run(hre, async function() {
                return await earningToken.connect(
                    admin.signer
                ).approve(nft, allowance);
            });
        } else {
            const calldata = earningToken.interface.encodeFunctionData(
                'approve', [nft, allowance]
            );
            const safe = await gnosis.getSafe(hre);
            await gnosis.propose(safe, earningToken.address, calldata);
        }
        logger.info("=========== nft-admin-setallowance end ===========");
    });

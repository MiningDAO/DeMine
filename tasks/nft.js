const { types } = require("hardhat/config");
const assert = require("assert");
const logger = require('npmlog');
const common = require("../lib/common.js");
const time = require("../lib/time.js");
const state = require("../lib/state.js");
const diamond = require("../lib/diamond.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");

function parsePeriod(period) {
    const [start, end] = period.split(',');
    var startTs, endTs;
    if (time.validateDate(start) && time.validateDate(end)) {
        startTs = time.toEpoch(new Date(start));
        endTs = time.toEpoch(new Date(end));
    } else {
        startTs = parseInt(start);
        endTs = parseInt(end);
    }
    assert(startTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    assert(endTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    return [startTs, endTs];
}

function parseTokenIds(args) {
    const [startTs, endTs] = parsePeriod(args.period);
    assert(token.validateTokenType(args.type), 'invalid token type');
    const tokenIds = token.genTokenIds(startTs, endTs, args.type);
    assert(tokenIds.length > 0, 'No token will be issued');
    return tokenIds;
}

function parseToken(input) {
    const [startTs, endTs] = parsePeriod(input);
    if (endTs - startTs == 86400) {
        return token.genTokenId(startTs, 'daily');
    }
    if (endTs - startTs == 86400 * 7) {
        return token.genTokenId(startTs, 'weekly');
    }
    if (endTs - startTs == 86400 * 14) {
        return token.genTokenId(startTs, 'biweekly');
    }
    throw 'Invalid token input';
}

function binanceConfig(localConfig, network) {
    assert(
        network.name == 'bsc' || network.name == 'bscdev',
        'Error: Only bsc and bscdev network are supported'
    );
    return network.name == 'bsc'
        ? localConfig.binance.prod
        : localConfig.binance.test;
}

function validateCommon(args, hre) {
    assert(network.name !== 'hardhat', 'Not supported at hardhat network');
    common.validateCoin(args.coin);
}

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        validateCommon(args, hre);

        const { admin, custodian } = await ethers.getNamedSigners();
        const base = await common.getDeployment(hre, 'Diamond');
        const erc1155Facet = await common.getDeployment(hre, 'ERC1155Facet');
        const contracts = state.tryLoadContracts(hre, args.coin);
        if (
            contracts.nft &&
            contracts.nft.target &&
            contracts.nft.source == base.address &&
            contracts.nft.fallback == erc1155Facet.address
        ) {
            logger.warn("Nothing changed, exiting");
            return;
        }

        const wrapped = (contracts.wrapped && contracts.wrapped.target)
            || await hre.run('wrapped-clone', { coin: args.coin });
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            wrapped
        );

        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const initArgs = await diamond.genInitArgs(
            hre,
            admin.address,
            erc1155Facet.address,
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint8", "address", "string"],
                [custodian.address, royaltyBps, reward.address, uri]
            ),
            [],
            ['IERC1155Rewardable', 'IERC1155']
        );
        console.log('Will clone DeMineNFT from ' + base.address + ' with: ');
        console.log(JSON.stringify({
            network: network.name,
            source: base.address,
            owner: admin.address,
            fallback: erc1155Facet.address,
            fallbackInitArgs: {
                reward: {
                    address: reward.address,
                    name: await reward.name(),
                    symbol: await reward.symbol(),
                    decimals: await reward.decimals()
                },
                royaltyRecipient: custodian.address,
                royaltyBps: royaltyBps,
                baseUri: uri
            }
        }, null, 2));

        const { events } = receipt = await common.prompt(async function() {
            return await base.create(initArgs);
        });
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned contract DeMineNFT at ' + cloned);
        state.updateContract(
            hre, args.coin, {
                'nft': {
                    source: base.address,
                    target: cloned,
                    fallback: erc1155Facet.address,
                    txReceipt: receipt
                }
            }
        );
        return cloned;
    });

task('nft-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('date', 'Date to finalize, format: YYYY-MM-DD')
    .addFlag('enforce', 'enforce to set even the hashrate is smaller than supply')
    .setAction(async (args, { ethers, network } = hre) => {
        validateCommon(args, hre);
        assert(args.date && time.validateDate(args.date), 'invalid date');

        const { admin, custodian } = await ethers.getNamedSigners();
        const nft = state.loadNFTClone(hre, args.coin);
        logger.info(`NFT ${nft.target} loaded`);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const rewardToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );
        logger.info(`Reward token ${rewardToken.address} loaded`);

        const format = function(ts) {
            return `${ts}(${new Date(ts).toISOString()})`;
        }
        const finalized = await erc1155Facet.finalized();
        logger.info(`Latest finalized is ${format(finalized)}`);

        const finalizing = args.date
            ? time.toEpoch(new Date(args.date))
            : finalized + 86400; // move one more day
        logger.info(`Finalizing ${format(finalizing)}`);
        const now = time.toEpoch(new Date());
        assert(finalizing > finalized, `Error: already finalized`);
        assert(finalizing < now, `Error: cannot finalize future tokens`);

        const poolStats = (finalizing == time.startOfDay(time.epoch()))
            ? await antpool.statsYesterday(localConfig.antpool, args.coin)
            : await antpool.stats(localConfig.antpool, args.coin, finalizing);
        logger.info(`AntPool stats: ${JSON.stringify(poolStats)}`);

        const hashPerToken = localConfig.hashPerToken[args.coin.toLowerCase()];
        const hashrate = poolStats.hashrate / hashPerToken;
        const supply = state.getSupply(hre, coin, nft, finalizing);
        logger.info(`Token supply is ${supply}`);

        if (hashrate < supply) {
            const errMsg = "Effective hashrate is lower than token supply!"
            assert(args.enforce, "Error: " + errMsg);
            logger.warning(errMsg);
        }
        const decimals = rewardToken.decimals().toNumber();
        const canonicalizedTotalEarned = Math.floor(
            poolStats.totalEarned * (10 ** deciamls)
        );
        const tokenValue = Math.floor(canonicalizedTotalEarned / hashrate);
        const toDeposit = ethers.BigNumber.from(tokenValue).mul(supply);
        var deposit = {
            source: 'custodian',
            balance: await rewardToken.balanceOf(custodian.address), // bignumber
            amount: toDeposit // bignumber
        }
        if (deposit.balance.lt(deposit.amount)) {
            const errMsg = "Insufficient custodian balance";
            assert(network.name == 'bsc', 'Error: ' + errMsg);
            logger.warn(errMsg + ", using binance account...");
            deposit = {
                source: 'binance',
                balance: await binance.balanceOf(
                    binanceConfig(localConfig, network),
                    args.coin.toUpperCase()
                ), // float
                amount: toDeposit.toNumber() / (10 ** decimals()) // float
            };
            assert(
                deposit.balance > deposit.amount,
                'Error: insufficient balance at binance account'
            );
        }

        console.log('Summary: ');
        common.print({
            source: nft.source,
            address: nft.target,
            finalized: finalized,
            finalizing: finalizing,
            token: {
                value: tokenValue,
                supply: supply.toString()
            },
            antpool: poolStats,
            deposit: {
                source: deposit.source,
                balance: deposit.balance.toString(),
                amount: deposit.amount.toString()
            }
        });

        console.log("Step 1: Deposit");
        if (deposit.source == 'custodian' && deposit.amount.gt(0)) {
            await common.prompt(async function() {
                await rewardToken.connect(custodian).transfer(
                    nft.target,
                    deposit.amount
                );
            });
        } else if (deposit.source == 'binance' && deposit > 0) {
            await common.prompt(async function() {
                await binance.withdraw(
                    binanceConfig(localConfig, network),
                    {
                        coin: args.coin.toUpperCase(),
                        network: network.name.toUpperCase(),
                        address: nft.target,
                        amount: deposit.amount
                    }
                );
            });
        } else {
            console.log('Deposit amount is 0, skipping');
        }

        console.log("Step 2: Finalize");
        await common.prompt(async function() {
            return await erc1155Facet.connect(admin).finalize(finalizing, tokenValue);
        });
    });

task('nft-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('period', 'date range, format: yyyy-MM-dd,yyyy-MM-dd')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .addParam('supply', 'supply per token', undefined, types.int)
    .addOptionalParam('to', 'recipient of minted tokens')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        validateCommon(args, hre);

        const tokenIds = parseTokenIds(args);
        const { admin, custodian } = await ethers.getNamedSigners();
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);

        assert(
            tokenIds[0].start > time.epoch() + 43200,
            'Choose a different start date'
        );
        var amounts = [];
        for (let i = 0; i < tokenIds.length; i++) {
            amounts.push(args.supply);
        }

        const to = args.to || custodian.address;
        const info = {
            source: nft.source,
            contract: nft.target,
            to: to,
            ids: JSON.stringify(tokenIds),
            amounts: JSON.stringify(amounts)
        };
        console.log('Will mint nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            const txReceipt = await erc1155Facet.connect(admin).mintBatch(
                to, token.encode(ethers, tokenIds), amounts, []
            );
            console.log(txReceipt);
            state.updateAndSaveSupply(txReceipt);
        });
    });

task('nft-burn', 'burn demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('period', 'date range, format: yyyy-MM-dd,yyyy-MM-dd')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .addParam('amounts', 'amount to burn per token')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const tokenIds = parseTokenIds(args);
        const { admin } = await ethers.getNamedSigners();
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);

        assert(
            tokenIds[0].start > time.epoch() + 86400,
            'Too late to burn the first token, choose a different start date'
        );
        const amounts = args.amounts.split(',').map(i => parseInt(i));
        assert(amounts.length == tokenIds.length, 'amounts array length mismatch');
        const info = {
            source: nft.source,
            contract: nft.target,
            from: admin.address,
            ids: JSON.stringify(tokenIds),
            amounts: args.amounts
        };
        console.log('Will burn nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            const txReceipt = await erc1155Facet.connect(admin).burnBatch(
                token.encode(ethers, ids),
                amounts
            );
            console.log(txReceipt);
            state.updateAndSaveSupply(txReceipt);
        });
    });

task('nft-transfer', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('token', 'token id, format: start,end')
    .addParam('amount', 'amount to transfer', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        validateCommon(args, hre);

        const { admin, custodian } = await ethers.getNamedSigners();
        const id = parseToken(args.token);
        const to = ethers.utils.getAddress(args.to);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const info = {
            source: nft.source,
            contract: nft.target,
            from: custodian.address,
            to: to.address,
            id: id,
            amount: amount
        };
        console.log('Will transfer nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc1155Facet.connect(custodian).safeBatchTransferFrom(
                custodian.address, to, token.encodeOne(ethers, id), amount, []
            );
        });
    });

task('nft-token', 'check earning for token starting with date specified')
    .addParam('coin', 'Coin to check')
    .addParam('token', 'token id, format: start,end')
    .setAction(async (args, { ethers, network } = hre) => {
        validateCommon(args, hre);

        const id = parseToken(args.token);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const finalized = (await erc1155Facet.finalized()).toNumber();
        const result = await erc1155Facet.earning(token.encodeOne(ethers, id));
        console.log(JSON.stringify({
            token: id,
            contract: nft.target,
            earning: result.toString(),
            supply: state.getSupply(hre, args.coin, nft, id.start).toString(),
            lastestFinalized: finalized
        }, null, 2));
        return result;
    });

task('nft-balance', 'check DeMineNFT balance for user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('token', 'token id, format: start,end')
    .setAction(async (args, { ethers, network }) => {
        validateCommon(args, hre);

        const id = parseToken(args.token);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const balance = await erc1155Facet.balanceOf(
            ethers.utils.getAddress(args.who),
            token.encodeOne(ethers, id)
        );
        console.log(JSON.stringify({
            token: id,
            balance: balance.toNumber(),
        }, null, 2));
        return balance.toNumber();
    });

task('nft-inspect', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addOptionalParam('history', 'Num of historical tokens to look back', 5, types.int)
    .setAction(async (args, { ethers, network }) => {
        validateCommon(args, hre);

        logger.info('Loading nft contract...');
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const finalized = (await erc1155Facet.finalized()).toNumber();

        logger.info('Collecting history...');
        var history = [];
        for (let i = 0; i < args.history && finalized > 0; i++) {
            if (finalized < i * 86400) {
                break;
            }
            const tokenId = token.genTokenId(finalized - i * 86400, 'daily');
            history.push({
                tokenId,
                earning: await erc1155Facet.earning(
                    token.encodeOne(ethers, tokenId)
                )
            });
        }

        logger.info('Checking owner...');
        const base = await ethers.getContractAt('Diamond', nft.target);
        const ownership = {
            owner: await base.owner(),
            nomineeOwner: await base.nomineeOwner(),
        };

        logger.info('Checking royalty settings...');
        const royaltyInfo = await erc1155Facet.royaltyInfo(1, 10000);
        logger.info('Checking earning token balance...');
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );
        const earningToken = {
            address: reward.address,
            name: await reward.name(),
            symbol: await reward.symbol(),
            decimals: await reward.decimals(),
            balance: (await reward.balanceOf(nft.target)).toString()
        };
        logger.info('Generating summary...');
        console.log(JSON.stringify({
            source: nft.source,
            address: nft.target,
            ownership,
            earningToken,
            paused: await base.paused(),
            finalized: { finalized, history,},
            uri: await erc1155Facet.uri(0),
            royaltyInfo: {
                recipient: royaltyInfo[0],
                bps: royaltyInfo[1].toNumber(),
            }
        }, undefined, 2));
    });

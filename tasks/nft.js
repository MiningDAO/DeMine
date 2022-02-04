const { types } = require("hardhat/config");
const assert = require("assert");
const common = require("../lib/common.js");
const time = require("../lib/time.js");
const state = require("../lib/state.js");
const token = require("../lib/token.js");
const antpool = require("../lib/antpool.js");
const binance = require("../lib/binance.js");

function binanceConfig(localConfig, network) {
    assert(
        network.name == 'bsc' || network.name == 'bscdev',
        'Error: Only bsc and bscdev network are supported'
    );
    return network.name == 'bsc'
        ? localConfig.binance.prod
        : localConfig.binance.test;
}

task('nft-test', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { localConfig } = hre) => {
        common.print(await antpool.statsYesterday(
            localConfig.antpool,
            args.coin
        ));
    });

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const diamond = await common.getDeployment(hre, 'Diamond');

        const nft = state.loadNFTClone(hre, args.coin);
        if (nft && nft.target && nft.source == diamond.address) {
            logger.warning("Nothing changed, exiting");
            return;
        }

        const wrapped = (coinConfig.wrapped && coinConfig.wrapped.target)
            || await hre.run('wrapped-clone', { coin: args.coin });
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            wrapped
        );

        const { admin, custodian } = await ethers.getNamedSigners();
        const erc1155Facet = await common.getDeployment(hre, 'ERC1155Facet');
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const initArgs = await common.genInitArgs(
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
        console.log('Will clone DeMineNFT from ' + diamond.address + ' with: ');
        console.log(JSON.stringify({
            source: diamond.address,
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
            return await diamond.create(initArgs);
        });
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned contract DeMineNFT at ' + cloned);
        state.updateContract(
            hre, args.coin, {
                'nft': {
                    source: diamond.address,
                    target: cloned,
                    txReceipt: txReceipt
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
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(args.date && time.validateDate(arg.date), 'invalid date');
        common.validateCoin(args.coin);

        const nft = state.loadNFTClone(hre, args.coin);
        logger.info(`NFT is ${rewardToken.address}`);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const { admin, custodian } = await ethers.getNamedSigners();
        const rewardToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );
        logger.info(`Reward token is ${rewardToken.address}`);

        const format = function(ts) {
            return `${ts}(${new Date(ts).toISOString()})`;
        }
        const finalized = await erc1155Facet.finalized();
        logger.info(`Latest finalized: ${format(finalized)}`);

        const toFinalize = args.date
            ? time.toEpoch(new Date(args.date))
            : finalized + 86400; // move one more day
        logger.info(`To finalized: ${format(toFinalize)}`);

        const now = time.toEpoch(new Date());
        assert(toFinalize > finalized, `Error: already finalized`);
        assert(toFinalize < now, `Error: cannot finalize future tokens`);

        const poolStats = (toFinalize == time.startOfDay(time.epoch()))
            ? await antpool.statsYesterday(localConfig.antpool, args.coin)
            : await antpool.stats(localConfig.antpool, args.coin, toFinalize);

        const hashPerToken = localConfig.hashPerToken[args.coin.toLowerCase()];
        const hashrate = poolStats.hashrate / hashPerToken;
        const supply = state.getAndUpdateSupply(hre, coin, nft, toFinalize);
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
            contract: nft.target,
            lastFinalized: finalized,
            tokenValue,
            tokenSupply: supply.toString(),
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
            return await erc1155Facet.connect(admin).finalize(toFinalize, tokenValue);
        });
    });

task('nft-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('start', 'start date')
    .addParam('end', 'end date')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .addParam('supply', 'supply per token', undefined, types.int)
    .addOptionalParam('to', 'recipient of minted tokens')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(time.validateDate(arg.start), 'invalid start date');
        assert(time.validateDate(arg.end), 'invalid end date');
        assert(token.validateTokenType(arg.type), 'invalid token type');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);

        const tokenIds = token.genTokenIds(args.start, args.end, args.type);
        assert(tokenIds.length > 0, 'No token will be issued');
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
            return await erc1155Facet.connect(admin).mintBatch(
                to, token.encode(ethers, tokenIds), amounts, []
            );
        });
    });

task('nft-burn', 'burn demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('start', 'start date')
    .addParam('end', 'end date')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .addParam('amounts', 'amount to burn per token')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(time.validateDate(arg.start), 'invalid start date');
        assert(time.validateDate(arg.end), 'invalid end date');
        assert(token.validateTokenType(arg.type), 'invalid token type');
        common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);

        const tokenIds = token.genTokenIds(args.start, args.end, args.type);
        assert(tokenIds.length > 0, 'No token will be burned');
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
            return await erc1155Facet.connect(admin).burnBatch(
                token.encode(ethers, ids),
                amounts
            );
        });
    });

task('nft-transfer', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('start', 'start date')
    .addParam('end', 'end date')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .addParam('amounts', 'amounts, comma seperated')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(time.validateDate(arg.start), 'invalid start date');
        assert(time.validateDate(arg.end), 'invalid end date');
        assert(token.validateTokenType(arg.type), 'invalid token type');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        const to = ethers.utils.getAddress(args.to);
        const ids = token.genTokenIds(args.start, args.end, args.type);
        const amounts = args.amounts.split(',').map(i => parseInt(i));
        assert(ids.length == amounts.length, 'array length mismatch');

        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const info = {
            source: nft.source,
            contract: nft.target,
            from: custodian.address,
            to: to.address,
            ids: JSON.stringify(ids),
            amounts: JSON.stringify(amounts)
        };
        console.log('Will transfer nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc1155Facet.connect(custodian).safeBatchTransferFrom(
                custodian.address, to, token.encode(ethers, ids), amounts, []
            );
        });
    });

task('nft-earning', 'check earning for token starting with date specified')
    .addParam('coin', 'Coin to check')
    .addParam('start', 'start date')
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(time.validateDate(arg.start), 'invalid start date');
        assert(token.validateTokenType(arg.type), 'invalid token type');
        common.validateCoin(args.coin);

        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const finalized = (await erc1155Facet.finalized()).toNumber();
        const id = token.genTokenId(time.toEpoch(new Date(args.start)), args.type);
        const result = erc1155.earning(token.encodeOne(id));
        console.log(JSON.stringify({
            earning: result,
            lastestFinalized: finalized,
            ...id
        }, null, 2));
        return result;
    });

task('nft-balance', 'check DeMineNFT balance for user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('type', 'token type, specify daily, weekly or biweekly')
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(time.validateDate(arg.start), 'invalid start date');
        assert(token.validateTokenType(arg.type), 'invalid token type');
        common.validateCoin(args.coin);

        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const id = token.genTokenId(time.toEpoch(new Date(args.start)), args.type);
        const balance = await erc1155Facet.balanceOf(
            ethers.utils.getAddress(args.who),
            token.encodeOne(ethers, id)
        );
        console.log(JSON.stringify({
            balance: balance.toNumber(),
            ...id
        }, null, 2));
        return balance.toNumber();
    });

task('nft-inspect', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addOptionalParam('history', 'Num of historical tokens to look back', 5, types.int)
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const finalized = (await erc1155Facet.finalized()).toNumber();
        var history = [];
        for (let i = 0; i < args.history; i++) {
            const tokenId = token.genTokenId(finalized - i * 86400, 'daily');
            history.push({
                tokenId,
                earning: await erc1155Facet.earning(
                    token.encodeOne(ethers, tokenId)
                )
            });
        }

        const diamond = await ethers.getContractAt('Diamond', nft.target);
        const royaltyInfo = await erc1155Facet.royaltyInfo(1, 10000);
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.earningToken()
        );

        const balance = await reward.balanceOf(nft.target);
        console.log(JSON.stringify({
            source: nft.source,
            address: nft.target,
            owner: await diamond.owner(),
            nomineeOwner: await diamond.nomineeOwner(),
            reward: {
                address: reward.address,
                name: await reward.name(),
                symbol: await reward.symbol(),
                decimals: await reward.decimals(),
                balance: balance.toNumber()
            },
            paused: await diamond.paused(),
            finalized: { finalized, history,},
            uri: await erc1155Facet.uri(0),
            royaltyInfo: {
                recipient: royaltyInfo[0],
                bps: royaltyInfo[1].toNumber(),
            }
        }, undefined, 2));
    });

async function genERC1155FacetCut(hre) {
    return await diamond.genFacetCut(hre, 'ERC1155Facet', [
        ['IERC1155', [
            'balanceOf',
            'balanceOfBatch',
            'isApprovedForAll',
            'setApprovalForAll',
            'safeTransferFrom',
            'safeBatchTransferFrom',
        ]],
        ['IERC1155Metadata', ['uri']],
        ['IERC2981', ['royaltyInfo']],
        ['ERC1155Facet', ['mintBatch', 'burnBatch', 'setURI', 'setRoyaltyInfo']]
    ]);
}

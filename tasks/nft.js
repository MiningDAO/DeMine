const { types } = require("hardhat/config");
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const diamond = require("../lib/diamond.js");
const token = require("../lib/token.js");
const config = require("../lib/config.js");

function parseToken(input) {
    const [start, type] = input.split(',');
    const startTs = token.parseTs(start);
    return token.genTokenId(startTs, type);
}

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== nft-clone start ===========");
        config.validateCoin(args.coin);

        const base = await config.getDeployment(hre, 'Diamond');
        const erc1155Facet = await config.getDeployment(hre, 'ERC1155Facet');
        const contracts = state.tryLoadContracts(hre, args.coin);
        if (
            contracts.nft &&
            contracts.nft.target &&
            contracts.nft.source == base.address &&
            contracts.nft.fallback == erc1155Facet.address
        ) {
            logger.warn("Nothing changed.");
            logger.info("=========== nft-clone skipped ===========");
            return contracts.nft.target;
        }

        const wrappedConfig = localConfig.wrapped[network.name] || {};
        const wrapped = wrappedConfig[args.coin.toLowerCase()]
            || (contracts.wrapped && contracts.wrapped.target)
            || await hre.run('wrapped-clone', { coin: args.coin });
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol:IERC20Metadata',
            wrapped
        );

        const admin = await config.admin(hre);
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const iface = new hre.ethers.utils.Interface([
            'function init(address earningToken)'
        ]);
        const initArgs = [
            admin.address,
            await diamond.genInterfaces(
                hre,
                ['@solidstate/contracts/token/ERC1155/IERC1155.sol:IERC1155']
            ),
            erc1155Facet.address,
            iface.encodeFunctionData('init', [reward.address])
        ];
        logger.info('Cloning DeMineNFT: ' + JSON.stringify({
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
                royaltyRecipient: admin.address,
                royaltyBps: royaltyBps,
                baseUri: uri
            }
        }, null, 2));
        const { events } = receipt = await common.run(
            hre,
            async function() {
                return await base.create(initArgs);
            }
        );
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        logger.info('Cloned contract DeMineNFT at ' + cloned);

        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        logger.info('Setting up custody: ' + JSON.stringify({
            nft: cloned,
            admin: admin.address,
            approved: true
        }, null, 2));
        if (admin.signer) {
            await common.run(hre, async function() {
                return await custodian.connect(
                    admin.signer
                ).custody(cloned, admin.address, true)
            });
            logger.info('Custody setup done');
        } else {
            const calldata = custodian.interface.encodeFunctionData(
                'custody',
                [cloned, admin.address, true]
            );
            logger.info('Not signer, calling info: ' + JSON.stringify({
                operator: admin.address,
                contract: custodian.address,
                calldata
            }, null, 2));
        }

        logger.info('Writing contract info to state file');
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
        logger.info("=========== nft-clone end ===========");
        return cloned;
    });

task('nft-tokens', 'list tokens give date range')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        logger.info("=========== nft-tokens start ===========");
        const ids = token.parseTokenIds(args.tokens);
        const encoded = token.encode(ethers, ids);
        logger.info(JSON.stringify({
            numTokenTypes: ids.length,
            id: token.readableIds(encoded),
        }, null, 2));
        logger.info("=========== nft-tokens end ===========");
        return encoded;
    });

task('nft-inspect-token', 'check earning for token starting with date specified')
    .addParam('coin', 'Coin to check')
    .addParam('token', 'token id, format: start,type')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, network } = hre) => {
        logger.info("=========== nft-token start ===========");
        config.validateCoin(args.coin);

        const id = parseToken(args.token);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const finalized = (await erc1155Facet.finalized()).toNumber();
        const earning = await erc1155Facet.earning(token.encodeOne(ethers, id));
        const supply = await erc1155Facet.supplyOf(token.encodeOne(ethers, id));
        logger.info(JSON.stringify({
            token: id,
            contract: nft,
            earning: result.toString(),
            supply: supply.toString(),
            lastestFinalized: finalized
        }, null, 2));
        logger.info("=========== nft-token end ===========");
        return result;
    });

task('nft-balance', 'check DeMineNFT balance for user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('token', 'token id, format: start,type')
    .addOptionalParam('nft', 'nft contract address')
    .setAction(async (args, { ethers, network }) => {
        logger.info("=========== nft-balance start ===========");
        config.validateCoin(args.coin);

        const id = parseToken(args.token);
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const balance = await erc1155Facet.balanceOf(
            ethers.utils.getAddress(args.who),
            token.encodeOne(ethers, id)
        );
        logger.info(JSON.stringify({
            token: id,
            balance: balance.toNumber(),
        }, null, 2));
        logger.info("=========== nft-balance end ===========");
        return balance.toNumber();
    });

task('nft-inspect-contract', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addOptionalParam('nft', 'nft contract address')
    .addOptionalParam('history', 'Num of historical tokens to look back', 5, types.int)
    .setAction(async (args, { ethers, network }) => {
        logger.info("=========== nft-inspect start ===========");
        config.validateCoin(args.coin);

        logger.info('Loading nft contract...');
        const nft = args.nft || state.loadNFTClone(hre, args.coin).target;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const finalized = (await erc1155Facet.finalized()).toNumber();

        logger.info('Collecting history...');
        var history = [];
        for (let i = 0; i < args.history && finalized > 0; i++) {
            if (finalized < i * 86400) {
                break;
            }
            const tokenId = token.genTokenId(finalized - i * 86400 - 86400, 'daily');
            history.push({
                tokenId,
                earning: (await erc1155Facet.earning(
                    token.encodeOne(ethers, tokenId)
                )).toString()
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
        logger.info('Summary: ' + JSON.stringify({
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
        }, null, 2));
        logger.info("=========== nft-inspect end ===========");
    });

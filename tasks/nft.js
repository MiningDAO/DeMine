const { types } = require("hardhat/config");
const logger = require('npmlog');
const common = require("../lib/common.js");
const state = require("../lib/state.js");
const diamond = require("../lib/diamond.js");
const token = require("../lib/token.js");
const config = require("../lib/config.js");
const nftLib = require("../lib/nft.js");

function parseToken(input) {
    const [start, type] = input.split(',');
    const startTs = nftLib.parseTs(start);
    return token.genTokenId(startTs, type);
}

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
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
        logger.info('Cloning DeMineNFT');
        common.print({
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
        });
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

        logger.info('Setting up custody with follow info');
        const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
        common.print({
            nft: cloned,
            admin: admin.address,
            approved: true
        });
        if (admin.signer) {
            await common.run(hre, async function() {
                await custodian.connect(
                    admin.signer
                ).custody(cloned, admin.address, true)
            });
            logger.info('Custody setup done');
        } else {
            logger.info('Not signer, please call manually with following info');
            const calldata = custodian.interface.encodeFunctionData(
                'custody',
                [cloned, admin.address, true]
            );
            common.print({
                operator: admin.address,
                contract: custodian.address,
                calldata
            });
        }
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

task('nft-list-token', 'list tokens give date range')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('tokens', 'date range and token type, format: 2022-02-02,2022-02-10,daily')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        nftLib.validateCommon(args, hre);
        const nft = state.loadNFTClone(hre, args.coin);
        const ids = nftLib.parseTokenIds(args.tokens);
        console.log(JSON.stringify({
            source: nft.source,
            contract: nft.target,
            numTokenTypes: ids.length,
            id: ids.map(id => id.startDate.split('T')[0]).join(','),
        }, null, 2));
        return ids;
    });

task('nft-token', 'check earning for token starting with date specified')
    .addParam('coin', 'Coin to check')
    .addParam('token', 'token id, format: start,type')
    .setAction(async (args, { ethers, network } = hre) => {
        nftLib.validateCommon(args, hre);

        const id = parseToken(args.token);
        const nft = state.loadNFTClone(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const finalized = (await erc1155Facet.finalized()).toNumber();
        const earning = await erc1155Facet.earning(token.encodeOne(ethers, id));
        const supply = await erc1155Facet.supplyOf(token.encodeOne(ethers, id));
        console.log(JSON.stringify({
            token: id,
            contract: nft.target,
            earning: result.toString(),
            supply: supply.toString(),
            lastestFinalized: finalized
        }, null, 2));
        return result;
    });

task('nft-balance', 'check DeMineNFT balance for user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('token', 'token id, format: start,type')
    .setAction(async (args, { ethers, network }) => {
        nftLib.validateCommon(args, hre);

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
        nftLib.validateCommon(args, hre);

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
        logger.info('Generating summary...');
        common.print({
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
        });
    });

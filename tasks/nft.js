const { types } = require("hardhat/config");
const assert = require("assert");
const common = require("../lib/common.js");

function getNFT(hre, coin) {
    const contracts = require(hre.localConfig.contracts);
    const nft = ((contracts[hre.network.name] || {})[coin] || {}).nft || {};
    assert(nft.target, "No contract found");
    return nft;
}

function getRewardPerToken() {
    return 0;
}

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const diamond = await common.getDeployment(hre, 'Diamond');
        const contracts = require(localConfig.contracts);
        const coinConfig = (contracts[network.name] || {})[args.coin] || {};
        if (coinConfig.nft && coinConfig.nft.target && coinConfig.nft.source == diamond.address) {
            console.log("Nothing changed, skipping");
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
        const initArgs = await common.diamondInitArgs(
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

        const { events } = await common.prompt(async function() {
            return await diamond.create(initArgs);
        });
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned contract DeMineNFT at ' + cloned);
        common.saveContract(
            hre, args.coin, 'nft', {
                source: diamond.address,
                target: cloned
            }
        );
        return cloned;
    });

task('nft-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addOptionalParam('reward', 'reward per token to set')
    .setAction(async (args, { ethers, network } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const mining = await erc1155Facet.getMiningToken();
        const [
            [supply, rewardPerToken]
        ] = await erc1155Facet.getTokenInfo([mining]);
        assert(
            rewardPerToken.eq(ethers.BigNumber.from(0)),
            'unexpected reward per token ' + rewardPerToken + ' for token id ' + mining
        );

        const reward = args.reward || getRewardPerToken();
        const total = ethers.BigNumber.from(reward).mul(supply);

        const { admin, custodian } = await ethers.getNamedSigners();
        const rewardToken = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.getRewardToken()
        );
        const allowance = await rewardToken.allowance(custodian.address, nft.target);
        assert(
            allowance.gte(total),
            'Insufficient allowance, current=' + allowance + ', required=' + total
        );

        const balance = await rewardToken.balanceOf(custodian.address);
        assert(
            balance.gte(total),
            'Insufficient balance, current=' + balance + ', required=' + total
        );

        const info = {
            source: nft.source,
            contract: nft.target,
            miningToken: mining.toNumber(),
            supply: supply.toNumber(),
            reward: reward,
            total: total.toNumber(),
            allowance: allowance.toNumber(),
            balance: balance.toNumber()
        };
        console.log('Will finalize with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            // TODO: deposit total to nft contract
            return await erc1155Facet.connect(admin).finalize(reward);
        });
    });

task('nft-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('end', 'end token id', undefined, types.int)
    .addParam('supply', 'supply per token', undefined, types.int)
    .addOptionalParam('to', 'recipient of minted tokens')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        const { admin, custodian } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const mining = await erc1155Facet.getMiningToken();
        assert(ethers.BigNumber.from(args.start).gt(mining), 'You cannot start from mined token')
        assert(args.end > args.start && args.end - args.start < 1000, 'Too long duration')

        var ids = [], amounts = [];
        for (let i = args.start; i <= args.end; i++) {
            ids.push(i);
            amounts.push(args.supply);
        }
        const to = args.to || custodian.address;
        const info = {
            source: nft.source,
            contract: nft.target,
            to: to,
            ids: JSON.stringify(ids),
            amounts: JSON.stringify(amounts)
        };
        console.log('Will mint nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc1155Facet.connect(admin).mintBatch(
                to, ids, amounts, []
            );
        });
    });

task('nft-burn', 'burn demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('end', 'end token id', undefined, types.int)
    .addParam('amounts', 'amount to burn per token')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const mining = await erc1155Facet.getMiningToken();
        assert(ethers.BigNumber.from(args.start).gt(mining), 'You cannot start from mined token')
        assert(args.end > args.start && args.end - args.start < 500, 'Too long duration')

        const amounts = args.amounts.split(',').map(i => parseInt(i));
        assert(amounts.length == args.end - args.start + 1, 'amounts array length mismatch');
        const ids = Array(args.end - args.start + 1).fill().map((_, idx) => args.start + idx);
        const info = {
            source: nft.source,
            contract: nft.target,
            from: admin.address,
            ids: JSON.stringify(ids),
            amounts: args.amounts
        };
        console.log('Will burn nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc1155Facet.connect(admin).burnBatch(ids, amounts);
        });
    });

task('nft-transfer', 'transfer demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('to', 'address of recipient')
    .addParam('ids', 'token ids, comma seperated')
    .addParam('amounts', 'amounts, comma seperated')
    .setAction(async (args, { ethers, network, deployments } = hre) => {
        const { admin, custodian } = await ethers.getNamedSigners();

        const to = ethers.utils.getAddress(args.to);
        const ids = args.ids.split(',').map(i => parseInt(i));
        const amounts = args.amounts.split(',').map(i => parseInt(i));
        assert(ids.length == amounts.length, 'array length mismatch');

        const nft = getNFT(hre, args.coin);
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
                custodian.address, to, ids, amounts, []
            );
        });
    });

task('nft-reward', 'check reward of user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('start', 'start token id', undefined, types.int)
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        const account = ethers.utils.getAddress(args.who);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const mining = (await erc1155Facet.getMiningToken()).toNumber();
        assert(args.start < mining, 'start exceeding mining token ' + mining);
        const ids = Array(mining - args.start).fill().map((_, i) => i + args.start);
        var tokenInfo = await erc1155Facet.getTokenInfo(ids);
        var balances = await erc1155Facet.balanceOfBatch(
            Array(mining - args.start).fill(account), ids
        );
        var result = {total: 0, perToken: []};
        for (let i = args.start; i < mining; i++) {
            let info = tokenInfo[i - args.start];
            let balance = balances[i - args.start];
            result.total += balance.mul(info[1]).toNumber();
            result.perToken.push({
                tokenId: i,
                balance: balance.toNumber(),
                rewardPerToken: info[1].toNumber()
            })
        }
        console.log(JSON.stringify(result, null, 2));
        return result;
    });

task('nft-balance', 'check DeMineNFT balance for user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('end', 'end token id', undefined, types.int)
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        const account = ethers.utils.getAddress(args.who);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const start = args.start, end = args.end;
        assert(end >= start, 'end must be larger than start');
        assert(end - start <= 365, 'you can only check one-year data');
        const accounts = Array(end - start + 1).fill(account);
        const ids = Array(end - start + 1).fill().map((_, i) => i + start);
        const balances = await erc1155Facet.balanceOfBatch(accounts, ids);
        const total = balances.reduce((prev, cur) => cur.add(prev));
        const result = {
            total: total.toNumber(),
            balances: balances.map(b => b.toNumber())
        };
        console.log(JSON.stringify({
            total: result.total,
            balances: JSON.stringify(result.balances)
        }, null, 2));
        return result;
    });

task('nft-inspect', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addOptionalParam('history', 'Num of historical tokens to look back', 5, types.int)
    .setAction(async (args, { ethers, network }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = getNFT(hre, args.coin);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft.target);
        const mining = (await erc1155Facet.getMiningToken()).toNumber();
        var history = [];
        var start = Math.max(mining - args.history, 0);
        if (mining > start) {
            var tokenInfo = await erc1155Facet.getTokenInfo(
                Array(mining - start).fill().map((_, i) => i + start)
            );
            for (let i = start; i < mining; i++) {
                let info = tokenInfo[i - start];
                history.push({
                    tokenId: i,
                    supply: info[0].toNumber(),
                    reward: info[1].toNumber()
                });
            }
        }

        const diamond = await ethers.getContractAt('Diamond', nft.target);
        const royaltyInfo = await erc1155Facet.royaltyInfo(1, 10000);
        const reward = await ethers.getContractAt(
            '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
            await erc1155Facet.getRewardToken()
        );

        const balance = await reward.balanceOf(nft.target);
        const [miningToken] = await erc1155Facet.getTokenInfo([mining]);
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
            mining: {
                tokenId: mining,
                supply: miningToken[0].toNumber(),
                history: history,
            },
            uri: await erc1155Facet.uri(0),
            royaltyInfo: {
                recipient: royaltyInfo[0],
                bps: royaltyInfo[1].toNumber(),
            }
        }, undefined, 2));
    });

async function genERC1155FacetCut(hre) {
    return await common.genFacetCut(hre, 'ERC1155Facet', [
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

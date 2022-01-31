const { types } = require("hardhat/config");
const assert = require("assert");
const common = require("../lib/common.js");

task("nft-init", "init wrapped token")
    .addParam('contract', 'contract address')
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        const nft = await ethers.getContractAt('Diamond', args.contract);
        let localNetworkConfig = localConfig[network.name] || {};
        const income = await ethers.getContractAt(
            'DeMineERC20', localNetworkConfig[args.coin].wrapped
        );

        const erc1155Facet = await common.getDeployment(hre, 'ERC1155Facet');
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const initArgs = [
            admin.address,
            [],
            [],
            [],
            erc1155Facet.address,
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint8", "address", "string"],
                [custodian.address, royaltyBps, income.address, uri]
            ),
            await genInterfaces('IERC1155Rewardable')
        ];
        console.log('Will initialize DeMineNFT ' + args.contract + ' with: ');
        console.log(JSON.stringify({
            owner: admin.address,
            fallbackAddress: erc1155Facet.address,
            income: {
                address: income.address,
                name: await income.name(),
                symbol: await income.symbol(),
                decimals: await income.decimals()
            },
            royaltyRecipient: custodian.address,
            royaltyBps: royaltyBps
        }, null, 2));
        await common.prompt(async function() {
            return await nft.connect(admin).init(initArgs);
        });
    });

task('nft-clone', 'Deploy clone of demine nft')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const { admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};
        const coinConfig = localNetworkConfig[args.coin];
        const income = await ethers.getContractAt('DeMineERC20', coinConfig.wrapped);

        const erc1155Facet = await common.getDeployment(hre, 'ERC1155Facet');
        const royaltyBps = 100;
        const uri = localConfig.tokenUri[args.coin];
        const initArgs = [
            admin.address,
            [],
            [],
            [],
            erc1155Facet.address,
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint8", "address", "string"],
                [custodian.address, royaltyBps, income.address, uri]
            ),
            await genInterfaces('IERC1155Rewardable')
        ];

        const Base = await common.getDeployment(hre, 'DeMineNFT');
        console.log('Will clone DeMineNFT from ' + Base.address + ' with: ');
        console.log(JSON.stringify({
            owner: admin.address,
            fallbackAddress: erc1155Facet.address,
            income: {
                address: income.address,
                name: await income.name(),
                symbol: await income.symbol(),
                decimals: await income.decimals()
            },
            royaltyRecipient: custodian.address,
            royaltyBps: royaltyBps,
            baseUri: uri
        }, null, 2));

        const { events } = await common.prompt(async function() {
            return await Base.create(initArgs);
        });
        const { args: [from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned contract DeMineNFT at ' + cloned);
        return cloned;
    });

task('nft-finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('income', 'income per token', undefined, types.int)
    .addParam('mining', 'for validation, incase we finalized wrong token', undefined, types.int)
    .setAction(async (args, { ethers, network, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        assert(args.income >= 0, 'Income has to be non-negative number');

        let nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const mining = await erc1155Facet.getMining();
        assert(ethers.BigNumber.from(args.mining).eq(mining), 'wrong mining cycle');

        const [
            [supply, incomePerToken]
        ] = await erc1155Facet.getTokenInfo([mining]);
        assert(
            incomePerToken.eq(ethers.BigNumber.from(0)),
            'unexpected income per token ' + incomePerToken + ' for token id ' + mining
        );
        const total = ethers.BigNumber.from(args.income).mul(supply);

        const { admin, custodian } = await ethers.getNamedSigners();
        const miningPoolFacet = await ethers.getContractAt('MiningPoolFacet', nft);
        const income = await ethers.getContractAt(
            'DeMineERC20', await miningPoolFacet.treasureSource()
        );
        const allowance = await income.allowance(custodian.address, nft);
        assert(
            allowance.gte(total),
            'Insufficient allowance, current=' + allowance + ', required=' + total
        );

        const balance = await income.balanceOf(custodian.address);
        assert(
            balance.gte(total),
            'Insufficient balance, current=' + balance + ', required=' + total
        );

        const info = {
            tokenId: mining.toNumber(),
            supply: supply.toNumber(),
            income: args.income,
            total: total.toNumber(),
            incomeSource: custodian.address,
            allowance: allowance.toNumber(),
            balance: balance.toNumber()
        };
        console.log('Will finalize with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            // TODO: deposit total to nft contract
            return await miningPoolFacet.connect(admin).finalize(args.income);
        });
    });

task('nft-mint', 'mint new demine nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('recipient', 'recipient of minted tokens')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('end', 'end token id', undefined, types.int)
    .addParam('supply', 'supply per token', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        const account = ethers.utils.getAddress(args.recipient);

        let nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const mining = await erc1155Facet.getMining();
        assert(ethers.BigNumber.from(args.start).gt(mining), 'You cannot start from mined token')
        assert(args.end > args.start && args.end - args.start < 1000, 'Too long duration')

        var ids = [], amounts = [];
        for (let i = args.start; i <= args.end; i++) {
            ids.push(i);
            amounts.push(args.supply);
        }
        const info = {
            contract: nft,
            recipient: args.recipient,
            ids: JSON.stringify(ids),
            amounts: JSON.stringify(amounts)
        };
        console.log('Will mint nft with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc1155Facet.connect(admin).mintBatch(
                account, ids, amounts, []
            );
        });
    });

task('nft-income', 'check income of user')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('from', 'from token id to mining', undefined, types.int)
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        assert(range.length == 1, 'malformed range')
        const mining = (await erc1155Facet.getMining()).toNumber();
        assert(args.from < mining, 'start exceeding mining token ' + mining);
        const ids = Array(mining - args.from + 1).fill().map((_, i) => i + args.from);
        var tokenInfo = await erc1155Facet.getTokenInfo(ids);
        var balances = await erc1155Facet.balanceOfBatch(
            Array(mining - args.from).fill(account), ids
        );
        var result = {total: 0, perToken: []};
        for (let i = args.from; i < mining; i++) {
            let info = tokenInfo[i - args.from];
            let balance = balances[i - args.from];
            result.total += balance.mul(info[1]).toNumber();
            result.perToken.push({
                tokenId: i,
                balance: balance.toNumber(),
                incomePerToken: info[1].toNumber()
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
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        let nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const account = ethers.utils.getAddress(args.who);
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
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const mining = (await erc1155Facet.getMining()).toNumber();
        var history = [];
        var start = Math.max(mining - 5, 0);
        if (mining > start) {
            var tokenInfo = await erc1155Facet.getTokenInfo(
                Array(mining - start).fill().map((_, i) => i + start)
            );
            for (let i = start; i < mining; i++) {
                let info = tokenInfo[i - start];
                history.push({
                    tokenId: i,
                    supply: info[0].toNumber(),
                    income: info[1].toNumber()
                });
            }
        }

        const adminFacet = await ethers.getContractAt('DeMineNFT', nft);
        const royaltyInfo = await erc1155Facet.royaltyInfo(1, 10000);
        const miningPoolFacet = await ethers.getContractAt('MiningPoolFacet', nft);
        const income = await ethers.getContractAt(
            'DeMineERC20', await miningPoolFacet.treasureSource()
        );
        const balance = await income.balanceOf(nft);
        const [miningToken] = await erc1155Facet.getTokenInfo([mining]);
        console.log(JSON.stringify({
            address: nft,
            owner: await adminFacet.owner(),
            nomineeOwner: await adminFacet.nomineeOwner(),
            income: {
                address: income.address,
                name: await income.name(),
                symbol: await income.symbol(),
                decimals: await income.decimals(),
                balance: balance.toNumber()
            },
            paused: await adminFacet.paused(),
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

const assert = require("assert");
const common = require("../lib/common.js");

task('inspect-wrapped-token', 'Inspect state of DeMineERC20 contract')
    .addParam('coin', 'Coin to check')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const token = localConfig[network.name][args.coin].wrapped;
        const erc20 = await ethers.getContractAt('DeMineERC20', token);
        const result = {
            address: erc20.address,
            name: await erc20.name(),
            symbol: await erc20.symbol(),
            decimals: await erc20.decimals(),
            owner: await erc20.owner(),
            paused: await erc20.paused()
        }
        console.log(JSON.stringify(result, null, 2));
        return result;
    });

task('inspect-user', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to check')
    .addParam('who', 'account address')
    .addParam('what', 'data to inspect')
    .addParam('range', 'the range of token id, start,stop')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        let nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const account = ethers.utils.getAddress(args.who);
        const range = args.range.split(',');

        if (args.what == 'balance') {
            assert(range.length == 2, 'malformed range')
            const start = parseInt(range[0]), end = parseInt(range[1]);
            assert(end >= start, 'end must be larger than start');
            assert(end - start <= 365, 'you can only check one-year data');
            const accounts = Array(end - start + 1).fill(account);
            const ids = Array(end - start + 1).fill().map((_, i) => i + start);
            console.log(ids);
            const balances = await erc1155Facet.balanceOfBatch(accounts, ids);
            console.log(balances.map(b => b.toNumber()));
            return;
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
        } else if (args.what == 'income') {
            assert(range.length == 1, 'malformed range')
            const start = parseInt(range[0]);
            const mining = (await erc1155Facet.getMining()).toNumber();
            assert(start < mining, 'start exceeding mining token ' + mining);
            const ids = Array(mining - start + 1).fill().map((_, i) => i + start);
            var tokenInfo = await erc1155Facet.getTokenInfo(ids);
            var balances = await erc1155Facet.balanceOfBatch(
                Array(mining - start).fill(account), // accounts
                ids
            );
            var result = {total: 0, perToken: []};
            for (let i = start; i < mining; i++) {
                let info = tokenInfo[i - start];
                let balance = balances[i - start];
                result.total += balance.mul(info[1]).toNumber();
                result.perToken.push({
                    tokenId: i,
                    balance: balance.toNumber(),
                    incomePerToken: info[1].toNumber()
                })
            }
            console.log(JSON.stringify(result, null, 2));
            return result;
        } else {
            console.log(
                'invalid `what` param, only `balance` and `income` are supported'
            );
        }
    });

task('inspect-nft', 'Inspect state of DeMineNFT contract')
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

const assert = require("assert");
const common = require("../lib/common.js");

task('inspect-user', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addParam('who', 'account address')
    .addParam('what', 'data to inspect')
    .addParam('start', 'start token id')
    .addParam('end', 'end token id')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');

        let nft = localConfig[network.name][args.coin].nft;
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        if (args.what == 'balance') {
            assert(args.end > args.start, 'end must be larger than end');
            assert(args.end - args.start > 365, 'you can only check one-year data');
            const balances = await erc1155Facet.balanceOfBatch(
                Array(args.end - args.start + 1).fill(args.account), // accounts
                [...Array(args.end - args.start + 1).keys()].map(i => i + start) // ids
            );
            const result = {total: 0, tokens: []};
            for (let i = 0; i < ids.length; i++) {
                result.total += balance[i];
                result.tokens.push({
                    tokenId: ids[i],
                    balance: balances[i].toNumber()
                });
            }
            console.log(JSON.stringify(result, null, 2));
            return result;
        }

        if (arg.what == 'income') {
            const mining = (await erc1155Facet.getMining()).toNumber();
            assert(
                args.start < mining,
                'start has to be lower than current mining ' + mining
            );
            var ids = [...Array(mining - args.start).keys()].map(i => i + start);
            var tokenInfo = await erc1155Facet.getTokenInfo(ids);
            var balances = await erc1155Facet.balanceOfBatch(
                Array(mining - args.start).fill(args.account), // accounts
                ids
            );
            var result = {total: 0, perToken: []};
            for (let i = args.start; i < mining; i++) {
                let info = tokenInfo[i - args.start];
                let balance = balances[i - args.start];
                result.total += balance.mul(info[1]).toNumber();
                result.perToken.push({
                    tokenId: i,
                    balance: balance.toNumber(),
                    income: info[1]
                })
            }
            console.log(JSON.stringify(result, null, 2));
            return result;
        }
    });

task('inspect-nft', 'Inspect state of DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        let nft = localConfig[network.name][args.coin].nft;
        const adminFacet = await ethers.getContractAt('DeMineNFT', nft);
        const diamondFacet = await ethers.getContractAt('DiamondFacet', nft);
        const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
        const royaltyInfo = await erc1155Facet.royaltyInfo(1, 10000);
        const miningPoolFacet = await ethers.getContractAt('MiningPoolFacet', nft);
        const income = await ethers.getContractAt(
            'DeMineERC20', await miningPoolFacet.treasureSource()
        );
        const mining = (await erc1155Facet.getMining()).toNumber();
        const [miningToken] = await erc1155Facet.getTokenInfo([mining]);
        const balance = await income.balanceOf(nft);
        var history = [];
        var start = Math.max(mining - 5, 0);
        var tokenInfo = await erc1155Facet.getTokenInfo(
            [...Array(mining - start).keys()].map(i => i + start)
        );
        for (let i = start; i <= mining; i++) {
            let info = tokenInfo[i - start];
            history.push({
                tokenId: i,
                supply: info[0].toNumber(),
                income: info[1].toNumber()
            });
        }
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
            },
            facets: await diamondFacet.facets
        }, undefined, 2));
    });

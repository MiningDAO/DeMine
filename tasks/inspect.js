const assert = require("assert");
const common = require("../lib/common.js");

task('inspect-user', 'Inspect state of DeMineNFT contract')
    .addParam('account', 'account address')
    .setAction(async (args, { ethers, network, localConfig }) => {

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
        const mining = await erc1155Facet.getMining();
        const miningToken = await erc1155Facet.getTokenInfo(mining);
        const balance = await income.balanceOf(nft);
        var history = [];
        var start = Math.max(mining.toNumber() - 5, 0);
        for (let i = start; i < mining.toNumber(); i++) {
            let info = await erc1155Facet.getTokenInfo(i);
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
                tokenId: mining.toNumber(),
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

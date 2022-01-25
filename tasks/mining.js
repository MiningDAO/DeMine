const assert = require("assert");
const { types } = require("hardhat/config");
const common = require("./common.js");

task('finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('income', 'income per token', undefined, types.int)
    .addParam('mining', 'for validation, incase we finalized wrong token', undefined, types.int)
    .setAction(async (args, { ethers, network, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        assert(args.income >= 0, 'Income has to be non-negative number');

        let nft = localConfig[network.name][args.coin].nft;
        const miningPoolFacet = await ethers.getContractAt('MiningPoolFacet', nft);
        const mining = await miningPoolFacet.getMining();
        assert(ethers.BigNumber.from(args.mining).eq(mining), 'wrong mining cycle');

        const [supply, incomePerToken] = await miningPoolFacet.getTokenInfo(mining);
        assert(
            incomePerToken.eq(ethers.BigNumber.from(0)),
            'unexpected income per token ' + incomePerToken + ' for token id ' + mining
        );
        const total = ethers.BigNumber.from(args.income).mul(supply);

        const { admin, custodian } = await ethers.getNamedSigners();
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
            return await miningPoolFacet.connect(admin).finalize(
                custodian.address, args.income
            );
        });
    });

task('mint', 'mint new nft tokens')
    .addParam('coin', 'Coin of DeMineNFT')
    .addParam('recipient', 'recipient of minted tokens')
    .addParam('start', 'start token id', undefined, types.int)
    .addParam('end', 'end token id', undefined, types.int)
    .addParam('supply', 'supply per token', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        let nft = localConfig[network.name][args.coin].nft;
        const miningPoolFacet = await ethers.getContractAt('MiningPoolFacet', nft);
        const mining = await miningPoolFacet.getMining();
        assert(ethers.BigNumber.from(args.start).gt(mining), 'You cannot start from mined token')
        assert(args.end > args.start && args.end - args.start < 1000, 'Too long duration')

        var ids = [], amounts = [];
        for (let i = args.start; i <= args.end; i++) {
            ids.push(i);
            amounts.push(args.supply);
        }
        const info = {
            recipient: args.recipient,
            ids: JSON.stringify(ids),
            amounts: JSON.stringify(amounts)
        };
        console.log('Will mint tokens with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            const erc1155Facet = await ethers.getContractAt('ERC1155Facet', nft);
            return await erc1155Facet.connect(admin).mintBatch(
                ethers.utils.getAddress(args.recipient), ids, amounts, []
            );
        });
    });

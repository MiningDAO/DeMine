const assert = require("assert");
const { types } = require("hardhat/config");
const constants = require("./constants.js");

task('finalize', 'finalize cycle for DeMineNFT contract')
    .addParam('coin', 'Coin to deploy')
    .addParam('income', 'income per token', undefined, types.int)
    .addParam('mining', 'for validation, incase we finalized wrong token', undefined, types.int)
    .addFlag('dryrun', 'only do the check')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        assert(constants.SUPPORTED_COINS.includes(args.coin), 'unsupported coin');
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

        console.log(JSON.stringify({
            tokenId: mining.toNumber(),
            supply: supply.toNumber(),
            income: args.income,
            total: total.toNumber(),
            source: custodian.address,
            allowance: allowance.toNumber(),
            balance: balance.toNumber()
        }, null, 2));


        if (!args.dryrun) {
            await miningPoolFacet.connect(admin).finalize(
                custodian.address, args.income
            );
        }
    });

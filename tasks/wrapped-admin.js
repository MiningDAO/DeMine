const assert = require("assert");
const BigNumber = require('bignumber.js');
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const config = require("../lib/config.js");
const state = require("../lib/state.js");

task('wrapped-mint', 'mint new nft tokens')
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('amount', 'amount to mint, decimal')
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== wrapped-mint start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const wrapped = args.contract || state.tryLoadWrappedClone(hre, coin).target;
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped);
        const balance = await erc20.balanceOf(admin.address);

        const decimals = await erc20.decimals();
        const normalized = new BigNumber(10).pow(decimals).times(args.amount);
        const amount = ethers.BigNumber.from(normalized.integerValue().toString());

        logger.info('Minting erc20 tokens: ' + JSON.stringify({
            contract: wrapped,
            metadata: {
                name: await erc20.name(),
                symbol: await erc20.symbol(),
                decimals: decimals
            },
            to: admin.address,
            currentBalance: balance.toString(),
            toMint: amount.toString()
        }, null, 2));

        const result = await common.run(
            hre,
            admin,
            erc20,
            'mint',
            [["to", admin.address], ["amount", amount]]
        );
        logger.info("=========== wrapped-mint end ===========");
        return result;
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== wrapped-burn start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const wrapped = args.contract || state.tryLoadWrappedClone(hre, coin).target;
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped);
        const balance = await erc20.balanceOf(admin.address);
        assert(
            new BigNumber(balance.toString()).lt(args.amount),
            'insufficient balance to burn'
        );
        logger.info('Burning ERC20: ' + JSON.stringify({
            address: wrapped,
            metadata: {
                name: await erc20.name(),
                symbol: await erc20.symbol(),
                decimals: await erc20.decimals()
            },
            from: admin.address,
            currentBalance: balance.toString(),
            toBurn: args.amount
        }, null, 2));

        const result = await common.run(
            hre, admin, erc20, 'burn', [["amount", args.amount]]
        );
        logger.info("=========== wrapped-burn end ===========");
        return result;
    });

const assert = require("assert");
const common = require("../lib/common.js");

task("wrapped-clone", "clone wrapped token")
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers, network, localConfig } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const diamond = await common.getDeployment(hre, 'Diamond');
        const contracts = require(localConfig.contracts);
        const coinConfig = ((contracts[network.name] || {})[args.coin] || {}).wrapped || {};
        if (coinConfig.target && coinConfig.source == diamond.address) {
            console.log("Nothing changed, skipping");
            return;
        }

        const { admin } = await ethers.getNamedSigners();
        const config = localConfig.wrapped[args.coin];
        const fallback = await common.getDeployment(hre, 'ERC20Facet');
        const initArgs = await common.diamondInitArgs(
            hre,
            admin.address,
            fallback.address,
            ethers.utils.defaultAbiCoder.encode(
                ["string", "string", "uint8"],
                [config.name, config.symbol, config.decimals]
            ),
            [],
            ['@solidstate/contracts/token/ERC20/IERC20.sol:IERC20']
        );
        console.log('Will clone DeMineERC20 from ' + diamond.address + ' with: ');
        console.log(JSON.stringify({
            source: diamond.address,
            owner: admin.address,
            fallback: fallback.address,
            fallbackInitArgs: {
                name: config.name,
                symbol: config.symbol,
                decimals: config.decimals
            }
        }, null, 2));
        const { events } = await common.prompt(async function() {
            return await diamond.create(initArgs);
        });
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned DeMineERC20 at ' + cloned);
        common.saveContract(
            hre, args.coin, 'wrapped', {
                source: diamond.address,
                target: cloned
            }
        );
        return cloned;
    });

task('inspect-wrapped-token', 'Inspect state of DeMineERC20 contract')
    .addParam('coin', 'Coin to check')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const token = localConfig[network.name][args.coin].wrapped;
        const erc20 = await ethers.getContractAt('ERC20Facet', token);
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

task('wrapped-mint', 'mint new nft tokens')
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('amount', 'amount to mint', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin, custodian } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const coin = localConfig[network.name][args.coin].wrapped;
        const erc20 = await ethers.getContractAt('ERC20Facet', coin);
        const balance = await erc20.balanceOf(custodian.address);
        const info = {
            contract: coin,
            to: custodian.address,
            currentBalance: balance.toNumber(),
            toMint: args.amount
        };
        console.log('Will mint wrapped coin ' + args.coin + ' with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc20.connect(admin).mint(
                custodian.address, args.amount
            );
        });
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin, custodian } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const coin = localConfig[network.name][args.coin].wrapped;
        const erc20 = await ethers.getContractAt('ERC20Facet', coin);
        const balance = await erc20.balanceOf(custodian.address);
        assert(balance.toNumber() >= args.amount, 'insufficient balance to bunr');
        const info = {
            contract: coin,
            from: custodian.address,
            currentBalance: balance.toNumber(),
            toBurn: args.amount
        };
        console.log('Will burn wrapped coin ' + args.coin + ' with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            await erc20.connect(custodian).transfer(
                admin.address, args.amount
            );
            return await erc20.connect(admin).burn(args.amount);
        });
    });

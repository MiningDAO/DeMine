const assert = require("assert");
const common = require("../lib/common.js");
const diamond = require("../lib/diamond.js");
const state = require("../lib/state.js");

function getWrapped(hre, coin) {
    const wrapped = state.tryLoadWrappedClone(hre, coin);
    assert(wrapped && wrapped.target, "No contract found");
    return wrapped;
}

task("wrapped-clone", "clone wrapped token")
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers, network, localConfig } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const base = await common.getDeployment(hre, 'Diamond');
        const fallback = await common.getDeployment(hre, 'ERC20Facet');
        const wrapped = state.tryLoadWrappedClone(hre, args.coin);
        if (
            wrapped &&
            wrapped.target &&
            wrapped.source == base.address &&
            wrapped.fallback == fallback.address
        ) {
            console.log("Nothing changed, skipping");
            return;
        }

        const config = localConfig.wrapped[args.coin];
        const initArgs = await diamond.genInitArgs(
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
        console.log('Will clone DeMineERC20 from ' + base.address + ' with: ');
        console.log(JSON.stringify({
            source: base.address,
            owner: admin.address,
            fallback: fallback.address,
            fallbackInitArgs: {
                name: config.name,
                symbol: config.symbol,
                decimals: config.decimals
            }
        }, null, 2));
        const { events } = receipt = await common.prompt(async function() {
            return await base.create(initArgs);
        });
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned DeMineERC20 at ' + cloned);
        state.updateContract(
            hre, args.coin, {
                'wrapped': {
                    source: base.address,
                    target: cloned,
                    fallback: fallback.address,
                    txReceipt: receipt
                }
            }
        );
        return cloned;
    });

task('wrapped-inspect', 'Inspect state of DeMineERC20 contract')
    .addParam('coin', 'Coin to check')
    .setAction(async (args, { ethers, network, localConfig }) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const wrapped = getWrapped(hre, args.coin);
        const diamond = await ethers.getContractAt('Diamond', wrapped.target);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped.target);
        const result = {
            source: wrapped.source,
            address: wrapped.target,
            owner: await diamond.owner(),
            paused: await diamond.paused(),
            name: await erc20.name(),
            symbol: await erc20.symbol(),
            decimals: await erc20.decimals()
        }
        console.log(JSON.stringify(result, null, 2));
        return result;
    });

task("wrapped-balance", "check balance")
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('who', 'address to check')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);
        const wrapped = getWrapped(hre, args.coin);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped.target);
        const balance = await erc20.balanceOf(args.who);
        common.print({
            source: wrapped.source,
            erc20: wrapped.target,
            account: args.who,
            balance: balance.toString()
        });
        return balance;
    });


task('wrapped-mint', 'mint new nft tokens')
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('amount', 'amount to mint', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const wrapped = getWrapped(hre, args.coin);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped.target);
        const balance = await erc20.balanceOf(admin.address);
        const info = {
            source: wrapped.source,
            contract: wrapped.target,
            to: admin.address,
            currentBalance: balance.toNumber(),
            toMint: args.amount
        };
        console.log('Will mint wrapped coin ' + args.coin + ' with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc20.connect(admin).mint(
                admin.address, args.amount
            );
        });
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const wrapped = getWrapped(hre, args.coin);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped.target);
        const balance = await erc20.balanceOf(admin.address);
        assert(balance.toNumber() >= args.amount, 'insufficient balance to bunr');
        const info = {
            source: wrapped.source,
            contract: wrapped.target,
            from: admin.address,
            currentBalance: balance.toNumber(),
            toBurn: args.amount
        };
        console.log('Will burn wrapped coin ' + args.coin + ' with following info:');
        console.log(JSON.stringify(info, null, 2));
        await common.prompt(async function() {
            return await erc20.connect(admin).burn(args.amount);
        });
    });

const assert = require("assert");
const logger = require('npmlog');
const common = require("../lib/common.js");
const config = require("../lib/config.js");
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
        args.coin == 'usd' || config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const base = await config.getDeployment(hre, 'Diamond');
        const fallback = await config.getDeployment(hre, 'ERC20Facet');
        const wrapped = state.tryLoadWrappedClone(hre, args.coin);
        if (
            wrapped &&
            wrapped.target &&
            wrapped.source == base.address &&
            wrapped.fallback == fallback.address
        ) {
            logger.info("Nothing changed, skipping");
            return;
        }

        const iface = new hre.ethers.utils.Interface([
            'function init(string name, string name, uint8 decimals)'
        ]);
        const c = localConfig.wrapped[args.coin];
        const initArgs = [
            admin.address,
            await diamond.genInterfaces(hre, [
                '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20',
            ]),
            fallback.address,
            iface.encodeFunctionData('init', [
                c.name, c.symbol, c.decimals
            ]),
        ];
        logger.info('Will clone DeMineERC20 from ' + base.address + ' with: ');
        logger.info(JSON.stringify({
            source: base.address,
            owner: admin.address,
            fallback: fallback.address,
            fallbackInitArgs: {
                name: c.name,
                symbol: c.symbol,
                decimals: c.decimals
            }
        }, null, 2));
        const { events } = receipt = await common.run(
            hre,
            async function() {
                return await base.create(initArgs);
            }
        );
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        logger.info('Cloned DeMineERC20 at ' + cloned);

        const erc20 = await ethers.getContractAt('ERC20Facet', cloned);
        const supply = ethers.BigNumber.from(10).pow(c.decimals).mul(1000);
        common.print({
            operator: admin.address,
            to: admin.address,
            supply: supply.toString()
        });
        logger.info('Minting supply to admin with following info');
        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc20.connect(
                    admin.signer
                ).mint(admin.address, 10000000000);
            });
        } else {
            const calldata = erc20.interface.encodeFunctionData(
                'mint',
                [admin.address, 10000000000]
            );
            logger.info('Not signer, call with following calldata');
            common.print({
                operator: admin.address,
                contract: erc20.address,
                calldata
            });
        }

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
        config.validateCoin(args.coin);

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
        logger.info(JSON.stringify(result, null, 2));
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
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
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
        logger.info('Will mint wrapped coin ' + args.coin + ' with following info:');
        logger.info(JSON.stringify(info, null, 2));
        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc20.connect(admin.signer).mint(
                    admin.address, args.amount
                );
            })
        } else {
            logger.info('Not signer, call with following calldata');
            const calldata = erc20.interface.encodeFunctionData(
                'mint', [admin.address, args.amount]
            );
            common.print({
                operator: admin.address,
                contract: erc20.address,
                calldata
            });
        }
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
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
        logger.info('Will burn wrapped coin ' + args.coin + ' with following info:');
        logger.info(JSON.stringify(info, null, 2));
        if (admin.signer) {
            await common.run(hre, async function() {
                return await erc20.connect(admin.signer).burn(args.amount);
            });
        } else {
            logger.info('Not signer, call with following calldata');
            const calldata = erc20.interface.encodeFunctionData(
                'burn', [args.amount]
            );
            common.print({
                operator: admin.address,
                contract: erc20.address,
                calldata
            });
        }
    });

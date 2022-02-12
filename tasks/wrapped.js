const assert = require("assert");
const BigNumber = require('bignumber.js');
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const config = require("../lib/config.js");
const diamond = require("../lib/diamond.js");
const state = require("../lib/state.js");
const gnosis = require('../lib/gnosis.js');

function getWrapped(hre, coin) {
    const wrapped = state.tryLoadWrappedClone(hre, coin);
    assert(wrapped && wrapped.target, "No contract found");
    return wrapped.target;
}

task("wrapped-clone", "clone wrapped token")
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers, network, localConfig } = hre) {
        logger.info("===========  wrapped-clone start ===========");
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
        logger.info('Cloning DeMineERC20: ' + JSON.stringify({
            source: base.address,
            owner: admin.address,
            fallback: fallback.address,
            earningTokenfallbackInitArgs: {
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
        logger.info('Writing contract info to state file');
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
        logger.info("===========  wrapped-clone end ===========");
        return cloned;
    });

task('wrapped-inspect', 'Inspect state of DeMineERC20 contract')
    .addParam('coin', 'Coin to check')
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, localConfig }) => {
        logger.info("===========  wrapped-inspect start ===========");
        config.validateCoin(args.coin);

        const wrapped = args.contract || getWrapped(hre, args.coin);
        const diamond = await ethers.getContractAt('Diamond', wrapped);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped);
        const result = {
            address: wrapped,
            owner: await diamond.owner(),
            paused: await diamond.paused(),
            metadata: {
                name: await erc20.name(),
                symbol: await erc20.symbol(),
                decimals: await erc20.decimals()
            },
        }
        logger.info(JSON.stringify(result, null, 2));
        logger.info("===========  wrapped-inspect end ===========");
        return result;
    });

task("wrapped-balance", "check balance")
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('who', 'address to check')
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== wrapped-balance start ===========");
        config.validateCoin(args.coin);

        const wrapped = args.contract || getWrapped(hre, args.coin);
        const erc20 = await ethers.getContractAt('ERC20Facet', wrapped);
        const balance = await erc20.balanceOf(args.who);
        logger.info(JSON.stringify({
            erc20: wrapped,
            metadata: {
                name: await erc20.name(),
                symbol: await erc20.symbol(),
                decimals: await erc20.decimals()
            },
            account: args.who,
            balance: balance.toString()
        }, null, 2));
        logger.info("=========== wrapped-balance end ===========");
        return balance;
    });


task('wrapped-mint', 'mint new nft tokens')
    .addParam('coin', 'wrapped token type, btc/eth/fil')
    .addParam('amount', 'amount to mint, decimal')
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== wrapped-mint start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const wrapped = args.contract || getWrapped(hre, args.coin);
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

        if (admin.type == 'GNOSIS') {
            const calldata = erc20.interface.encodeFunctionData(
                'mint', [admin.address, amount]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc20.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc20.connect(admin.signer).mint(
                    admin.address, amount
                );
            });
        }
        logger.info("=========== wrapped-mint end ===========");
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .addOptionalParam('contract', 'wrapped contract address')
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        logger.info("=========== wrapped-burn start ===========");
        config.validateCoin(args.coin);

        const admin = await config.admin(hre);
        const wrapped = args.contract || getWrapped(hre, args.coin);
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

        if (admin.type == 'GNOSIS') {
            const calldata = erc20.interface.encodeFunctionData(
                'burn', [args.amount]
            );
            const safe = await gnosis.getSafe(hre, admin);
            await gnosis.propose(hre, safe, erc20.address, calldata);
        } else {
            await common.run(hre, async function() {
                return await erc20.connect(admin.signer).burn(args.amount);
            });
        }
        logger.info("=========== wrapped-burn end ===========");
    });

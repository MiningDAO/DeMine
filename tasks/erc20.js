const { types } = require("hardhat/config");
const assert = require("assert");
const logger = require('../lib/logger.js');
const common = require("../lib/common.js");
const config = require("../lib/config.js");
const diamond = require("../lib/diamond.js");
const state = require("../lib/state.js");

function contractPath(symbol, decimals) {
    return 'ERC20-' + symbol + '-' + decimals;
}

task("erc20-create", "create new erc20 token")
    .addParam('name', 'token name')
    .addParam('symbol', 'token symbol')
    .addOptionalParam('decimals', 'token decimals', 18, types.int)
    .setAction(async function(args, { ethers, network } = hre) {
        logger.info("===========  ERC20 create start ===========");

        const admin = await config.admin(hre);
        const base = await config.getDeployment(hre, 'Diamond');
        const fallback = await config.getDeployment(hre, 'ERC20Facet');
        const path = contractPath(args.symbol, args.decimals);
        const loaded = state.tryLoadContracts(hre, path);
        if (
            loaded &&
            loaded.target &&
            loaded.source == base.address &&
            loaded.fallback == fallback.address
        ) {
            logger.info("Nothing changed, skipping");
            return;
        }

        const iface = new hre.ethers.utils.Interface([
            'function init(string name, string name, uint8 decimals)'
        ]);
        const initArgs = [
            admin.address,
            await diamond.genInterfaces(hre, [
                '@solidstate/contracts/token/ERC20/IERC20.sol:IERC20',
            ]),
            fallback.address,
            iface.encodeFunctionData('init', [
                args.name, args.symbol, args.decimals
            ]),
        ];
        logger.info('Cloning DeMineERC20: ' + JSON.stringify({
            source: base.address,
            owner: admin.address,
            fallback: fallback.address,
            earningTokenfallbackInitArgs: {
                name: args.name,
                symbol: args.symbol,
                decimals: args.decimals
            }
        }, null, 2));
        const {cloned, txReceipt} = await common.clone(
            hre, admin.signer, base, initArgs,
        );
        logger.info('New ERC20 token created at ' + cloned);
        logger.info('Writing contract info to state file');
        state.updateContract(
            hre, path, {
                source: base.address,
                target: cloned,
                fallback: fallback.address,
                txReceipt
            }
        );
        logger.info("===========  erc20-create end ===========");
        return cloned;
    });

task('erc20-inspect', 'Inspect state of ERC20 contract')
    .addParam('symbol', 'token symbol')
    .addOptionalParam('decimals', 'token decimals', 18, types.int)
    .setAction(async (args, { ethers, network }) => {
        logger.info("===========  wrapped-inspect start ===========");
        const path = contractPath(args.symbol, args.decimals);
        const loaded = state.tryLoadContracts(hre, path);
        const target = loaded.target;

        const diamond = await ethers.getContractAt('Diamond', target);
        const erc20 = await ethers.getContractAt('ERC20Facet', target);
        const result = {
            address: target,
            owner: await diamond.owner(),
            paused: await diamond.paused(),
            supply: (await erc20.totalSupply()).toString(),
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

const assert = require("assert");
const common = require("../lib/common.js");

task("wrapped-init", "init wrapped token")
    .addParam('contract', 'contract address')
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers, localConfig } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const config = localConfig.wrapped[args.coin];
        const diamondFacet = await common.getDeployment(hre, 'DiamondFacet');
        const erc20Facet = await common.getDeployment(hre, 'ERC20Facet');
        const erc20 = await ethers.getContractAt('DeMineERC20', args.contract);
        const facetCuts = [await common.genDiamondFacetCut(hre)];

        console.log('Will initialize DeMineERC20 ' + args.contract + ' with: ');
        console.log(JSON.stringify({
            contractToInitialize: erc20.address,
            owner: admin.address,
            diamondFacet: diamonFacet.address,
            erc20Facet: erc20Facet.address,
            fallbackAddress: erc20Facet.address,
            facetCuts: facetCuts,
            name: config.name,
            symbol: config.symbol,
            decimals: config.decimals,
        }, null, 2));
        await common.prompt(async function() {
            return await erc20.connect(admin).initialize(
                admin.address,
                diamonFacet.address,
                erc20Facet.address,
                facetCuts,
                config.name,
                config.symbol,
                config.decimals
            );
        });
    });

task("wrapped-clone", "clone wrapped token")
    .addParam('coin', 'coin type')
    .setAction(async function(args, { ethers } = hre) {
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        args.coin == 'usd' || common.validateCoin(args.coin);

        const { admin } = await ethers.getNamedSigners();
        const Base = await common.getDeployment(hre, 'DeMineERC20');
        const config = localConfig.wrapped[args.coin];
        const diamondFacet = await common.getDeployment(hre, 'DiamondFacet');
        const erc20Facet = await common.getDeployment(hre, 'ERC20Facet');
        const facetCuts = [await common.genDiamondFacetCut(hre)];

        console.log('Will clone DeMineERC20 from ' + Base.address + ' with: ');
        console.log(JSON.stringify({
            source: Base.address,
            owner: admin.address,
            diamondFacet: diamonFacet.address,
            erc20Facet: erc20Facet.address,
            fallbackAddress: erc20Facet.address,
            facetCuts: facetCuts,
            name: config.name,
            symbol: config.symbol,
            decimals: config.decimals
        }, null, 2));
        const { events } = await common.prompt(async function() {
            return await Base.create(
                admin.address,
                diamondFacet.address,
                erc20Facet.address,
                facetCuts,
                config.name,
                config.symbol,
                config.decimals
            );
        });
        const { args: [_from, cloned] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log('Cloned DeMineERC20 at ' + cloned);
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
            return await erc20.connect(admin).mint(args.amount);
        });
    });

task('wrapped-burn', 'burn wrapped tokens')
    .addParam('coin', 'wrapped token type, usd/btc/eth/fil')
    .addParam('amount', 'amount to burn', undefined, types.int)
    .setAction(async (args, { ethers, network, deployments, localConfig } = hre) => {
        const { admin } = await ethers.getNamedSigners();
        assert(network.name !== 'hardhat', 'Not supported at hardhat network');
        common.validateCoin(args.coin);

        const coin = localConfig[network.name][args.coin].wrapped;
        const erc20 = await ethers.getContractAt('ERC20Facet', coin);
        const balance = await erc20.balanceOf(admin.address);
        assert(balance.toNumber() >= args.amount, 'insufficient balance to bunr');
        const info = {
            contract: coin,
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

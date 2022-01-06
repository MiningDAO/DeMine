const { types } = require("hardhat/config");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

async function deployFactory(ethers, name) {
    const { deployer } = await ethers.getNamedSigners();
    const Factory = await ethers.getContractFactory(name, deployer);
    const factory = await Factory.deploy();
    await factory.deployed();
    const gasUsed = gas(await factory.deployTransaction.wait());
    console.log(
        'Deploying ' + name + ' at ' + factory.address +
        ' with ' + gasUsed + ' gas'
    );
    return factory.address;
}

async function cloneWrappedToken(ethers, factory, meta) {
    const { deployer, admin } = await ethers.getNamedSigners();

    // ensure wrapped token clone factory is deployed
    factory = factory || await deployFactory(
        ethers, 'WrappedTokenCloneFactory'
    );
    const factoryContract = await ethers.getContractAt(
        'WrappedTokenCloneFactory', factory, deployer
    );

    // clone wrapped token
    const tx = await factoryContract.create(
        meta.name,
        meta.symbol,
        meta.decimals,
        admin.address
    );
    const { events } = txReceipt = await tx.wait();
    const { args: [token] } = events.find(
        function(e) { return e.event === 'Clone'; }
    );
    console.log(
        'Cloning WrappedToken ' + meta.symbol + ' at ' +
        token + ' with ' + gas(txReceipt) + ' gas'
    );
    return token;
}

task('clone-demine', 'Deploy clone of demine nft and agent')
    .addOptionalParam('factory', 'contract address of demine clone factory')
    .setAction(async (args, { ehters, network, localConfig }) => {
        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        // ensure wrapped tokens are deployed
        const tokens = localNetworkConfig.wrappedToken?.tokens || {};
        const tokenFactory = tokens.factory || await deployFactory(
            ethers, 'WrappedTokenCloneFactory'
        );
        const tokenMeta = localConfig.wrappedTokenMeta;
        const reward = tokens.reward || await cloneWrappedToken(
            ethers, tokenFactory, tokenMeta.reward
        );
        const payments = tokens.payments || await Promise.all(
            tokenMeta.payments.map(
                p => cloneWrappedToken(ethers, tokenFactory, p)
            )
        );

        // ensure demine clone factory is deployed
        const factory = args.factory || await deployFactory(
            ethers, 'DeMineCloneFactory'
        );
        const factoryContract = await ethers.getContractAt(
            'DeMineCloneFactory', factory, deployer
        );

        // clone nft and agent contract
        const tx = await factoryContract.create(
            localConfig.tokenUri,
            custodian.address,
            100,
            reward,
            payments,
            custodian.address,
            admin.address
        );
        const { events } = txReceipt = await tx.wait();
        const { args: [nft, agent] } = events.find(
            function(e) { return e.event === 'Clone'; }
        );
        console.log(
            'Cloning contract DeMineNFT at ' + nft +
            ' and DeMineAgent at ' + agent +
            ' with ' + gas(txReceipt) + ' gas'
        );
    });

task("clone-wrapped-token", "clone wrapped token")
    .addOptionalParam('factory', 'contract address of wrapped token clone factory')
    .addParam('name', 'Wrapped token name')
    .addParam('symbol', 'Wrapped token symbol')
    .addParam('decimals', 'Wrapped token decimals', undefined, types.int)
    .setAction(async function( args, { ethers }) {
        await cloneWrappedToken(ethers, args.factory, args);
    });

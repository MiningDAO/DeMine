const { types } = require("hardhat/config");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

async function getDeployment(deployer, deployments, name) {
    var deployment = await deployments.getOrNull(name);
    if (deployment === undefined) {
        // for hardhat network
        await deployments.run([name]);
        deployment = await deployments.getOrNull(name);
    }
    return await ethers.getContractAt(name, deployment.address, deployer);
}

async function cloneWrappedToken(ethers, deployments, meta) {
    const { deployer, admin } = await ethers.getNamedSigners();
    const Base = await getDeployment(
        deployer, deployments, 'WrappedToken'
    );
    const tx = await Base.clone();
    const { events } = txReceipt = await tx.wait();
    const { args: [_from, cloned] } = events.find(
        function(e) { return e.event === 'Clone'; }
    );
    console.log(
        'Cloning WrappedToken ' + meta.symbol + ' at ' +
        cloned + ' with ' + gas(txReceipt) + ' gas'
    );
    return cloned;
}

task('clone-demine', 'Deploy clone of demine nft and agent')
    .setAction(async (args, { ehters, network, deployments, localConfig }) => {
        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        // ensure wrapped tokens are deployed
        const tokens = localNetworkConfig.wrappedToken?.tokens || {};
        const tokenMeta = localConfig.wrappedTokenMeta;
        const income = tokens.income || await cloneWrappedToken(
            ethers, deployments, tokenMeta.income
        );
        const payment = tokens.income || await cloneWrappedToken(
            ethers, deployments, tokenMeta.payment
        );

        // clone nft and agent contract
        const factory = await getDeployment(
            deployer, deployments, 'DeMineCloneFactory'
        );
        const tx = await factory.create(
            localConfig.tokenUri,
            custodian.address,
            localConfig.royaltyBps,
            income,
            payment,
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
    .addParam('name', 'Wrapped token name')
    .addParam('symbol', 'Wrapped token symbol')
    .addParam('decimals', 'Wrapped token decimals', undefined, types.int)
    .setAction(async function(args, { ethers, deployments }) {
        await cloneWrappedToken(ethers, deployments, args);
    });

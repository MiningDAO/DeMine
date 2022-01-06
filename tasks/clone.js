const { types } = require("hardhat/config");

function gas(txReceipt) {
    const { cumulativeGasUsed, effectiveGasPrice } = txReceipt;
    const gas = cumulativeGasUsed.mul(effectiveGasPrice).div(1000000000);
    return gas.toNumber();
}

async function getDeployment(deployer, deployments, name) {
    var factory = await deployments.getOrNull(name);
    if (factory === undefined) {
        // for hardhat network
        await deployments.run([name]);
        factory = await deployments.getOrNull(name);
    }
    return await ethers.getContractAt(name, factory.address, deployer);
}

async function cloneWrappedToken(ethers, deployments, meta) {
    const { deployer, admin } = await ethers.getNamedSigners();
    const factory = await getDeployment(
        deployer, deployments, 'WrappedTokenCloneFactory'
    );
    const tx = await factory.create(
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
    .setAction(async (args, { ehters, network, deployments, localConfig }) => {
        const { deployer, admin, custodian } = await ethers.getNamedSigners();
        let localNetworkConfig = localConfig[network.name] || {};

        // ensure wrapped tokens are deployed
        const tokens = localNetworkConfig.wrappedToken?.tokens || {};
        const tokenMeta = localConfig.wrappedTokenMeta;
        const reward = tokens.reward || await cloneWrappedToken(
            ethers, deployments, tokenMeta.reward
        );
        const payments = tokens.payments || await Promise.all(
            tokenMeta.payments.map(
                p => cloneWrappedToken(ethers, deployments, p)
            )
        );

        // clone nft and agent contract
        const factory = await getDeployment(
            deployer, deployments, 'DeMineCloneFactory'
        );
        const tx = await factory.create(
            localConfig.tokenUri,
            custodian.address,
            localConfig.royaltyBps,
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

subtask("clone-wrapped-token", "clone wrapped token")
    .addParam('name', 'Wrapped token name')
    .addParam('symbol', 'Wrapped token symbol')
    .addParam('decimals', 'Wrapped token decimals', undefined, types.int)
    .setAction(async function(args, { ethers, deployments }) {
        await cloneWrappedToken(ethers, deployments, args);
    });

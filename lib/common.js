const logger = require('./logger.js');
const gnosis = require('./gnosis.js');
const utils = require('./utils.js');

async function execTx(hre, signer, populatedTx, options={}) {
    const func = async function() {
        return await signer.sendTransaction(populatedTx);
    };
    logger.info(`Executing tx: ${JSON.stringify(populatedTx, null, 2)}`);
    const txResp = hre.network.name == 'hardhat' || options.skipPrompts
        ? await func()
        : await utils.prompts(func, options);
    logger.info(`Tx response: ${JSON.stringify(txResp, null, 2)}`);
    const txReceipt = await txResp.wait();
    logger.info(`Tx receipt: ${JSON.stringify(txReceipt, null, 2)}`);
    return txReceipt;
}

async function confirmAndDeploy(hre, name, args) {
    const { deployer } = await hre.ethers.getNamedSigners();
    const { deploy, fetchIfDifferent } = hre.deployments;
    const toRun = async() => {
        await deploy(name, {
            from: deployer.address,
            args: args,
            log: true
        });
    };
    const { differences, address } = await fetchIfDifferent(
        name, {from: deployer.address, args: args}
    );
    if (hre.network.name == 'hardhat' || !differences) {
        // will print 'reusing' info
        return await toRun();
    } else {
        logger.info('Will deploy ' + name + ' at ' + hre.network.name);
        return await util.prompts(toRun);
    }
}

async function run(hre, admin, contract, fun, args, options={}) {
    if (admin.type == 'GNOSIS') {
        const calldata = contract.interface.encodeFunctionData(
            fun, args
        );
        const { safe, service } = await gnosis.getSafe(hre, admin);
        const safeTransaction = await safe.createTransaction({
            to: contract.address,
            data: calldata,
            value: 0,
        });
        if (options.dryrun) {
            return {
                tx: safeTransaction,
                signer: admin.signer,
                contract: contract,
                func: func,
                args: args
            }
        }
        return await gnosis.propose(
            safe, service, safeTransaction, options
        );
    } else {
        const populatedTx = await contract.connect(
            admin.signer
        ).populateTransaction[fun](...args);
        if (options.dryrun) {
            return {
                tx: populatedTx,
                signer: admin.signer,
                contract: contract,
                func: func,
                args: args
            };
        }
        return await execTx(
            hre, admin.signer, populatedTx, options
        );
    }
}

async function clone(hre, signer, base, initArgs) {
    const populatedTx = await base.connect(
        signer
    ).populateTransaction.create(initArgs);
    const { logs } = receipt = await execTx(
        hre, signer, populatedTx,
    );
    const { topics: [_hash, _from, cloned] } = logs.find(
        l => ethers.BigNumber.from(l.topics[1]).eq(
            ethers.BigNumber.from(base.address)
        )
    );
    const [address] = hre.ethers.utils.defaultAbiCoder.decode(
        ['address'], cloned
    );
    return {
        cloned: address,
        receipt
    };
}

module.exports = {
    execTx,
    run,
    confirmAndDeploy,
    clone,
}

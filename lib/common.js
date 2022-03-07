const ethers = require("ethers");
const BN = require("bignumber.js");
const logger = require('./logger.js');
const gnosis = require('./gnosis.js');
const utils = require('./utils.js');

async function execTx(hre, signer, populatedTx, options={}) {
    const func = async function() {
        return await signer.sendTransaction(populatedTx);
    };
    logger.info(`Executing tx: ${JSON.stringify(populatedTx, null, 2)}`);
    const txResponse =
        hre.network.name == 'hardhat' || options.skipPrompts
        ? await func()
        : await utils.prompts(func, options);
    logger.info(`Tx response: ${JSON.stringify(txResponse, null, 2)}`);
    const txReceipt = await txResponse.wait();
    logger.info(`Tx receipt: ${JSON.stringify(txReceipt, null, 2)}`);
    return txReceipt;
}

async function confirmAndDeploy(hre, name, args) {
    const { admin } = await hre.ethers.getNamedSigners();
    const { deploy, fetchIfDifferent } = hre.deployments;
    const toRun = async() => {
        await deploy(name, {
            from: admin.address,
            args: args,
            log: true
        });
    };
    const { differences, address } = await fetchIfDifferent(
        name, {from: admin.address, args: args}
    );
    if (hre.network.name == 'hardhat' || !differences) {
        // will print 'reusing' info
        return await toRun();
    } else {
        logger.info('Will deploy ' + name + ' at ' + hre.network.name);
        return await utils.prompts(toRun);
    }
}

async function run(hre, admin, contract, func, params, options={}) {
    var request = {
        signer: admin.signer,
        contract: contract,
        func: func,
        args: params,
    };
    var response = {};
    const normalize = (v) => {
        if (BN.isBigNumber(v)) {
            return ethers.BigNumber.from(v.toFixed());
        };
        if (Array.isArray(v)) {
            return v.map(vv => normalize(vv));
        }
        return v;
    };
    const argValues = params.map(([k, v]) => normalize(v));
    if (admin.type == 'GNOSIS') {
        const calldata = contract.interface.encodeFunctionData(
            func, argValues
        );
        const { safe, service } = await gnosis.getSafe(hre, admin);
        request.tx = await safe.createTransaction({
            to: contract.address,
            data: calldata,
            value: 0,
        });
        if (!options.dryrun) {
            const {gnosisRequest, _} = await gnosis.propose(
                safe, service, request.tx, options
            );
            request.gnosisRequest = gnosisRequest;
        }
    } else {
        request.tx = await contract.connect(
            admin.signer
        ).populateTransaction[func](...argValues);
        if (!options.dryrun) {
            response.txReceipt = await execTx(
                hre, admin.signer, request.tx, options
            );
        }
    }
    return {request, response};
}

async function clone(hre, signer, base, initArgs) {
    const populatedTx = await base.connect(
        signer
    ).populateTransaction.create(initArgs);
    const txReceipt = await execTx(hre, signer, populatedTx);
    const { logs } = txReceipt;
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
        txReceipt
    };
}

function getTransactionEvents(contracts, txReceipt) {
    const txEvents = {}
    for (const log of txReceipt.logs) {
        for (const contract of contracts) {
            try {
                const e = contract.interface.parseLog(log);
                txEvents[e.name] = e;
                break;
            } catch(err) {
                continue;
            }
        }
    }
    return txEvents
}

module.exports = {
    execTx,
    run,
    confirmAndDeploy,
    clone,
    getTransactionEvents,
}

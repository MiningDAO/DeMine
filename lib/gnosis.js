const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const Safe = require('@gnosis.pm/safe-core-sdk').default;
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;

const logger = require("./logger.js");
const utils = require("./utils.js");

async function service(hre) {
    const apiConf = hre.localConfig.gnosisSafe.api;
    const api = apiConf[hre.network.name] || apiConf.main;
    return new SafeServiceClient(api);
}

async function getSafe(hre, admin) {
    if (hre.shared.gnosis) {
        return hre.shared.gnosis;
    }
    const ethAdapter = new EthersAdapter({ethers, signer: admin.signer})
    const safe = await Safe.create({ ethAdapter, safeAddress: admin.address });
    return {safe, service: await service(hre)}
}

async function propose(safe, service, safeTransaction, options) {
    await safe.signTransaction(safeTransaction);
    const safeTxHash = await safe.getTransactionHash(safeTransaction);

    const senderAddress = await (safe.getEthAdapter()).getSignerAddress();
    const safeAddress = safe.getAddress();
    const request = {
        senderAddress,
        safeAddress,
        safeTransaction,
        safeTxHash,
    };
    logger.info('Gnosis propose: ' + JSON.stringify(request, null, 2));
    const func = async () => {
        return await service.proposeTransaction(request);
    };
    const response = options.skipPrompts
        ? await func()
        : await utils.prompts(func)
    return { request, response };
}

module.exports = {
    getSafe,
    propose,
}

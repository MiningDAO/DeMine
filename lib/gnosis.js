const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const Safe = require('@gnosis.pm/safe-core-sdk').default;
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;

const logger = require("../lib/logger.js");
const config = require("../lib/config.js");
const common = require("../lib/common.js");

async function service(hre) {
    const apiConf = hre.localConfig.gnosisSafe.api;
    const api = apiConf[hre.network.name] || apiConf.main;
    return new SafeServiceClient(api);
}

async function getSafe(hre, admin) {
    const ethAdapter = new EthersAdapter({ethers, signer: admin.signer})
    const safe = await Safe.create({ ethAdapter, safeAddress: admin.address });
    return {safe, service: await service(hre)}
}

async function _propose(safe, service, safeTransaction) {
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
    await common.prompts(async function() {
        return await service.proposeTransaction(request);
    });
    return request;
}

async function propose(hre, safeContainer, to, data) {
    const { safe, service } = safeContainer;
    const safeTransaction = await safe.createTransaction({
        to,
        data,
        value: 0,
    });
    return await _propose(safe, service, safeTransaction);
}

async function proposeMulti(hre, safeContainer, metadataList) {
    const { safe, service } = safeContainer;
    const safeTransaction = await safe.createTransaction(
        metadataList.map(
            (metadata) => (
                {
                    to: metadata.to,
                    data: metadata.data,
                    value: 0
                }
            )
        )
    );
    return await _propose(safe, service, safeTransaction);
}

module.exports = {
    getSafe,
    propose,
    proposeMulti,
}

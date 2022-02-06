const assert = require("assert");
const constants = require("./constants.js");

async function custodian(hre) {
    const custodian = hre.localConfig.custodian[hre.network.name];
    if (custodian) {
        return custodian;
    }
    const signers = await hre.ethers.getNamedSigners();
    return signers.custodian.address;
}

async function getDeployment(hre, name) {
    var deployment = await hre.deployments.get(name);
    return await hre.ethers.getContractAt(name, deployment.address);
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
}

module.exports = {
    custodian: custodian,
    validateCoin: validateCoin,
    getDeployment: getDeployment,
}

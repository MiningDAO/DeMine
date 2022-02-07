const assert = require("assert");
const constants = require("./constants.js");

async function admin(hre) {
    const admin = hre.localConfig.admin[hre.network.name];
    if (admin) {
        return {
            address: admin
        };
    }
    const signers = await hre.ethers.getNamedSigners();
    return {
        address: signers.admin.address,
        signer: signers.admin
    };
}

async function getDeployment(hre, name) {
    var deployment = await hre.deployments.get(name);
    return await hre.ethers.getContractAt(name, deployment.address);
}

function validateCoin(coin) {
    assert(constants.SUPPORTED_COINS.includes(coin), 'unsupported coin');
}

module.exports = {
    admin: admin,
    validateCoin: validateCoin,
    getDeployment: getDeployment,
}

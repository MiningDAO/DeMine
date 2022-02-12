const assert = require("assert");
const constants = require("./constants.js");

async function admin(hre) {
    const signers = await hre.ethers.getNamedSigners();
    const admin = hre.localConfig.gnosisSafe.admin[hre.network.name];
    if (admin) {
        return {
            address: admin,
            signer: signer.gnosis,
            type: 'GNOSIS'
        };
    }
    return {
        address: signers.admin.address,
        signer: signers.admin,
        type: 'EOA'
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

const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async ({ ethers, deployments } = hre) => {
    await common.confirmAndDeploy(hre, 'Diamond', []);
    await common.confirmAndDeploy(
        hre,
        'CustodianProxy',
        [await config.custodian(hre)]
    );
    if (hre.network.name == 'hardhat' || hre.network.name.endsWith('dev')) {
        await common.confirmAndDeploy(hre, 'ERC20Facet', []);
    }
    const custodianProxy = await config.getDeployment(hre, 'CustodianProxy');
    await common.confirmAndDeploy(
        hre,
        'ERC1155Facet',
        [custodianProxy.address]
    );
};

module.exports.tags = ['NFT'];

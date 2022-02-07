const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async ({ ethers, deployments } = hre) => {
    await common.confirmAndDeploy(hre, 'Diamond', []);
    await common.confirmAndDeploy(
        hre,
        'Custodian',
        [await config.admin(hre)]
    );
    if (hre.network.name == 'hardhat' || hre.network.name.endsWith('dev')) {
        await common.confirmAndDeploy(hre, 'ERC20Facet', []);
    }
    const custodian = await config.getDeployment(hre, 'Custodian');
    await common.confirmAndDeploy(
        hre,
        'ERC1155Facet',
        [custodian.address]
    );
};

module.exports.tags = ['NFT'];

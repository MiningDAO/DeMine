const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async ({ ethers, deployments } = hre) => {
    await common.confirmAndDeploy(hre, 'Diamond', []);
    const admin = await config.admin(hre);
    await common.confirmAndDeploy(
        hre,
        'ERC1155Custodian',
        [admin.address]
    );
    if (hre.network.name == 'hardhat' || hre.network.name.endsWith('dev')) {
        await common.confirmAndDeploy(hre, 'ERC20Facet', []);
    }
    const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
    await common.confirmAndDeploy(
        hre,
        'ERC1155Facet',
        [custodian.address]
    );
};

module.exports.tags = ['NFT'];

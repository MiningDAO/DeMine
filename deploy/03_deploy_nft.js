const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async ({ ethers, deployments } = hre) => {
    const admin = await config.admin(hre);
    await common.confirmAndDeploy(
        hre,
        'ERC1155Custodian',
        [admin.address]
    );
    const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
    await common.confirmAndDeploy(
        hre,
        'ERC1155Facet',
        [custodian.address]
    );
};

module.exports.tags = ['NFT'];

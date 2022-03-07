const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async ({ ethers, deployments } = hre) => {
    await common.confirmAndDeploy(hre, 'Diamond', []);
};

module.exports.tags = ['Local', 'Testnet', 'NFT', 'Agent'];

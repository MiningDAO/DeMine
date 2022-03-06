const common = require('../lib/common.js');

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'ERC20Facet', []);
    await common.confirmAndDeploy(hre, 'TestEarningToken', []);
};

module.exports.tags = ['Local', 'Testnet'];

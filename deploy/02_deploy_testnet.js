const common = require('../lib/common.js');
const config = require('../lib/config.js');

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'ERC20Facet', []);
};

module.exports.tags = ['Local', 'Testnet'];

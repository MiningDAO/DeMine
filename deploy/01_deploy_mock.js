const common = require('../lib/common.js');

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'ChainlinkMock', []);
    await common.confirmAndDeploy(hre, 'SwapRouterV2Mock', []);
};

module.exports.tags = ['Local'];

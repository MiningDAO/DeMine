const common = require('../lib/common.js');

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'Mining3', []);
};

module.exports.tags = ['Mining3'];

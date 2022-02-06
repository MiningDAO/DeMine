const common = require('../lib/common.js');

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'MortgageFacet', []);
    await common.confirmAndDeploy(hre, 'PrimaryMarketFacet', []);
    await common.confirmAndDeploy(hre, 'BillingFacet', []);
};

module.exports.tags = ['Agent'];

const common = require('../lib/common.js');

module.exports = async (hre) => {
    // deploy pricing strategy
    await common.confirmAndDeploy(hre, 'PricingStatic', []);
    await common.confirmAndDeploy(hre, 'PricingLinearDecay', []);

    // deploy facets
    await common.confirmAndDeploy(hre, 'MortgageFacet', []);
    await common.confirmAndDeploy(hre, 'PrimaryMarketFacet', []);
    await common.confirmAndDeploy(hre, 'BillingFacet', []);
};

module.exports.tags = ['Agent'];

const prompts = require('prompts');

module.exports = async ({ ethers, deployments, localConfig }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    console.log('Will deploy MortgageFacet');
    await prompts({
        await deploy('MortgageFacet', {
            from: deployer.address,
            log: true
        });
    });

    console.log('Will deploy PrimaryMarketFacet');
    await prompts({
        await deploy('PrimaryMarketFacet', {
            from: deployer.address,
            log: true
        });
    });

    console.log('Will deploy PrimaryMarketFacet');
    await prompts({
        await deploy('BillingFacet', {
            from: deployer.address,
            log: true
        });
    });
};

module.exports.tags = ['DeMineAgent'];

module.exports = async ({ ethers, deployments, localConfig }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    await deploy('MortgageFacet', {
        from: deployer.address,
        log: true
    });

    await deploy('PrimaryMarketFacet', {
        from: deployer.address,
        log: true
    });

    await deploy('BillingFacet', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DeMineAgent', 'DeMineProd'];

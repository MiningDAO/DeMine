module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    await deploy('DiamondFacet', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DiamondFacet', 'DeMine'];

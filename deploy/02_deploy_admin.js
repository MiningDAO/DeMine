module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    await deploy('DeMineAdminFacet', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DeMineAdminFacet', 'DeMine'];

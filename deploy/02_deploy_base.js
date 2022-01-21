module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    await deploy('DeMineBaseFacet', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DeMineBase', 'DeMine'];

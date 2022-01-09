module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    const { address: diamond } = await deploy('DiamondFacet', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['Diamond', 'DeMine'];

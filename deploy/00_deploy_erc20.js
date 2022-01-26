module.exports = async ({ ethers, deployments }) => {
    const { deployer } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    await deploy('ERC20Facet', {
        from: deployer.address,
        log: true
    });

    await deploy('DeMineERC20', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DeMineERC20', 'DeMine'];

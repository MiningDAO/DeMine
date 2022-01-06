module.exports = async ({ ethers, deployments }) => {
    const { deployer } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    await deploy('WrappedTokenCloneFactory', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['WrappedTokenCloneFactory'];

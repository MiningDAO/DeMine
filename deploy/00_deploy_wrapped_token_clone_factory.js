module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy('WrappedTokenCloneFactory', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['WrappedTokenCloneFactory'];

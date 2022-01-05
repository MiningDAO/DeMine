module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy('DeMineCloneFactory', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['DeMineCloneFactory'];

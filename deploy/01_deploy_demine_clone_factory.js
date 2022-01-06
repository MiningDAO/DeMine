module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    const { receipt } = await deploy('DeMineCloneFactory', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['DeMineCloneFactory'];

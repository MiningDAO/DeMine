module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    console.log("deployer: " + deployer.address);
    console.log("admin: " + admin.address);

    const { deploy } = deployments;
    const { address } = await deploy('DeMine', {
        from: deployer.address,
        log: true
    });
    const DeMine = ethers.getContractAt('DeMine', address);
    await DeMine.initialize(admin.address);
    console.log(await DeMine.owner());
};

module.exports.tags = ['DeMine'];

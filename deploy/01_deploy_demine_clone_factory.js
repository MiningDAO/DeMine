module.exports = async ({ethers}) => {
    const [deployer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DeMineCloneFactory");
    const factory = await Factory.deploy({
        from: deployer,
        log: true
    });
    await factory.deployed();
    console.log("DeMineCloneFactory: " + factory.address);
};

module.exports.tags = ['DeMineCloneFactory'];

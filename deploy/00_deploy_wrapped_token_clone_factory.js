module.exports = async ({ethers}) => {
    const [deployer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("WrappedTokenCloneFactory");
    const factory = await Factory.deploy({
        from: deployer,
        log: true
    });
    await factory.deployed();
    console.log("Wrapped Token Clone Factory: " + factory.address);
};

module.exports.tags = ['WrappedTokenCloneFactory'];

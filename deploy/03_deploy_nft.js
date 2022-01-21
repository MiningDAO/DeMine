module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin, custodian } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    await deploy('ERC1155Facet', {
        from: deployer.address,
        log: true
    });

    await deploy('DeMineNFTFacet', {
        from: deployer.address,
        log: true
    });

    await deploy('DeMineNFT', {
        from: deployer.address,
        log: true
    });
};

module.exports.tags = ['DeMineNFT', 'DeMine'];

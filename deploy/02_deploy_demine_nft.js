module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    const { address: diamond } = await deployments.get('DiamondFacet');

    const { address: erc2981 } = await deploy('ERC2981Facet', {
        from: deployer.address,
        log: true
    });

    const { address: erc1155Metadata } = await deploy('ERC1155MetadataFacet', {
        from: deployer.address,
        log: true
    });

    const { address: erc1155 } = await deploy('ERC1155WithAgentFacet', {
        from: deployer.address,
        log: true
    });

    const { address: libDeMineNFT } = await deploy('LibDeMineNFT', {
        from: deployer.address,
        log: true
    });
    const { address: demine } = await deploy('DeMineNFT', {
        libraries: {'LibDeMineNFT': libDeMineNFT},
        from: deployer.address,
        args: [diamond, erc2981, erc1155Metadata, erc1155],
        log: true
    });
};

module.exports.tags = ['DeMineNFT', 'DeMine'];

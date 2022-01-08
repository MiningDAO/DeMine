module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    console.log("deployer: " + deployer.address);
    console.log("admin: " + admin.address);

    const { address: diamond } = await deploy('DiamondFacet', {
        from: deployer.address,
        log: true
    });

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
        args: [admin.address, diamond, erc2981, erc1155Metadata, erc1155],
        log: true
    });

    const Diamond = await ethers.getContractAt('DiamondFacet', demine);
    console.log(await Diamond.facets());
    console.log(await Diamond.owner());
    console.log(await Diamond.paused());

    const ERC2981 = await ethers.getContractAt('ERC2981Facet', demine);
    console.log(await ERC2981.royaltyInfo(0, 100));

    const ERC1155Metadata = await ethers.getContractAt('ERC1155MetadataFacet', demine);
    console.log(await ERC1155Metadata.uri(0));

    const ERC1155 = await ethers.getContractAt('ERC1155WithAgentFacet', demine);
    console.log(await ERC1155.balanceOf(deployer.address, 0));
};

module.exports.tags = ['DeMineNFT', 'DeMine'];

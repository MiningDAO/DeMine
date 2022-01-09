module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    const { address: diamond } = await deployments.get('DiamondFacet');
    const { address: demineNFT } = await deployments.get('DeMineNFT');

    const { address: agentAdmin } = await deploy('AgentAdminFacet', {
        from: deployer.address,
        log: true
    });

    const { address: poolAdmin } = await deploy('PoolAdminFacet', {
        from: deployer.address,
        log: true
    });

    const { address: external } = await deploy('ExternalFacet', {
        from: deployer.address,
        log: true
    });

    const { address: libDeMineAgent } = await deploy('LibDeMineAgent', {
        from: deployer.address,
        log: true
    });
    const { address: demine } = await deploy('DeMineAgent', {
        libraries: {'LibDeMineAgent': libDeMineAgent},
        from: deployer.address,
        args: [demineNFT, diamond, erc2981, erc1155Metadata, erc1155],
        log: true
    });
};

module.exports.tags = ['DeMineAgent', 'DeMine'];

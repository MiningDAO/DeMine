const prompts = require('prompts');

module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin, custodian } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    console.log('Will deploy ERC1155Facet');
    await prompts({
        await deploy('ERC1155Facet', {
            from: deployer.address,
            args: [custodian],
            log: true
        });
    });

};

module.exports.tags = ['DeMineNFT', 'DeMineProd', 'DeMineDev'];

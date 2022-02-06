const prompts = require('prompts');

module.exports = async ({ ethers, deployments }) => {
    const { deployer, admin } = await ethers.getNamedSigners();
    const { deploy } = deployments;
    console.log('Will deploy ERC1155Facet');
    await prompts({
        await deploy('Diamond', {
            from: deployer.address,
            log: true
        });
    )};
};

module.exports.tags = ['DeMineProd', 'DeMineDev', 'DeMineNFT', 'DeMineAgent'];

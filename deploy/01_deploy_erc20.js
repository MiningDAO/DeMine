const prompts = require('prompts');

module.exports = async ({ ethers, deployments }) => {
    const { deployer } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    console.log('Will deploy ERC20Facet');
    await prompts({
        await deploy('ERC20Facet', {
            from: deployer.address,
            log: true
        });
    });

};

module.exports.tags = ['DeMineDev'];

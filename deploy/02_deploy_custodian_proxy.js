const prompts = require('prompts');
const config = require("../lib/config.js");

module.exports = async ({ ethers, deployments } = hre) => {
    const { deployer } = await ethers.getNamedSigners();
    const { deploy } = deployments;

    console.log('Will deploy CustodianProxy');
    await prompts({
        await deploy('CustodianProxy', {
            from: deployer.address,
            args: [config.custodian(hre)],
            log: true
        });
    });

};

module.exports.tags = ['DeMineProd', 'DeMineDev', 'DeMineNFT', 'DeMineAgent'];

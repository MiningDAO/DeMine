const common = require('../lib/common.js');
const config = require('../lib/config.js');

async function deployIfNotDeployed(name, args) {
    const beaconDeployment = await hre.deployments.getOrNull(name);
    if (beaconDeployment === undefined) {
        await common.confirmAndDeploy(hre, name, args);
    }
}

module.exports = async ({ethers, upgrades} = hre) => {
    await common.confirmAndDeploy(hre, 'Mining3', []);

    const mining3 = await hre.deployments.get('Mining3');
    await deployIfNotDeployed('UpgradeableBeacon', [mining3.address]);

    const beacon = await config.getDeployment(hre, 'UpgradeableBeacon');
    await common.confirmAndDeploy(hre, 'Mining3Proxy', [beacon.address]);

    const implementation = await beacon.implementation();
    if (mining3.address != implementation) {
        const admin = await config.admin(hre);
        await common.run(
            hre,
            admin,
            beacon,
            'upgradeTo',
            [['implementation', mining3.address]],
            {dryrun: false}
        );
    }
};

module.exports.tags = ['Mining3'];

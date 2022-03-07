const common = require('../lib/common.js');

function deployIfNotDeployed(name, args) {
    const beaconDeployment = await hre.deployments.getOrNull(name);
    if (beaconDeployment === null) {
        await common.confirmAndDeploy(hre, name, args);
    }
}

module.exports = async (hre) => {
    await common.confirmAndDeploy(hre, 'Mining3', []);

    const mining3 = await hre.deployments.get('Mining3');
    await deployIfNotDeployed('UpgradeableBeacon', [mining3.address]);

    await common.confirmAndDeploy(hre, 'Mining3Proxy', [beacon.address]);

    const beacon = await config.getDeployment('UpgradeableBeacon');
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

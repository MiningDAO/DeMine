require('@nomiclabs/hardhat-waffle');
require('hardhat-contract-sizer');
require('hardhat-gas-reporter');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('./tasks/clone.js');
require('./tasks/inspect.js');
require('./tasks/mining.js');

const config = require('./config');
extendEnvironment((hre) => {
    hre.localConfig = config;
});

task('accounts', 'Prints the list of accounts')
    .setAction(async (taskArgs, { ethers }) => {
        const signers = await ethers.getNamedSigners();
        for (const name of Object.keys(signers)) {
          formatted = (name + ": ").padEnd(15, " ");
          console.log(formatted + signers[name].address);
        }
    });

task('abi', 'Prints abi of contract')
    .addParam('contract', 'contract name')
    .setAction(async (taskArgs, { artifacts }) => {
        let artifact = await artifacts.readArtifact(taskArgs.contract);
        console.log(JSON.stringify(artifact.abi));
    });

module.exports = {
    solidity: '0.8.4',
    networks: {
        maticdev: {
            live: true,
            url: config.maticdev.alchemy,
            chainId: 80001,
            accounts: config.accounts
        },
        arbitrumdev: {
            live: true,
            url: config.arbitrumdev.alchemy,
            accounts: config.accounts
        }
    },
    namedAccounts: {
        deployer: {
            default: 0
        },
        admin: {
            default: 1
        },
        custodian: {
            default: 2
        }
    },
    gasReporter: {
        enabled: config.enableGasReporter,
        currency: 'USD',
        coinmarketcap: '1c5db8be-2272-42c9-8d48-51a072cdc5a1',
        gasPrice: 90
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 100,
        },
    },
    path: {
        deploy: 'deploy',
        deployments: 'deployments'
    }
};

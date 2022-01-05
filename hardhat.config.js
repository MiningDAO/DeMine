require('@nomiclabs/hardhat-waffle');
require('hardhat-contract-sizer');
require('hardhat-gas-reporter');
require('hardhat-deploy-ethers');
require('./tasks/clone.js');

const config = require('./config');
extendEnvironment((hre) => {
    hre.localConfig = config;
});

task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
      console.log(account.address);
    }
});

task('abi', 'Prints abi of contract')
    .addParam('contract', 'contract name')
    .setAction(async (taskArgs, hre) => {
        let artifact = await hre.artifacts.readArtifact(taskArgs.contract);
        console.log(artifact.abi);
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

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const config = {
    tokenUri: {
        btc: 'https://www.demine.com/nft/btc/',
        eth: 'https://www.demine.com/nft/eth/',
        fil: 'https://www.demine.com/nft/fil/'
    },
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER,
        process.env.ADMIN,
        process.env.CUSTODIAN,
        process.env.ALCHEMIST
    ],
    contracts: path.resolve(__dirname, './contracts.json'),
    alchemy: {
        matic: process.env.ALCHEMY_MATIC,
        maticdev: process.env.ALCHEMY_MATIC_DEV
    },
    wrapped: {
        usd: {
            name: 'DeMine Wrapped USD',
            symbol: 'DPAY',
            decimals: 6
        },
        btc: {
            name: 'DeMine Wrapped BTC',
            symbol: 'DBTC',
            decimals: 8
        },
        eth: {
            name: 'DeMine Wrapped ETH',
            symbol: 'DETH',
            decimals: 18
        },
        fil: {
            name: 'DeMine Wrapped FIL',
            symbol: 'DFIL',
            decimals: 18
        }
    },
    enableGasReporter: true
};

module.exports = config;

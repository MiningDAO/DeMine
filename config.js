require('dotenv').config();

const wrappedTokenMeta = {
    payment: {
        name: 'DeMine Test Payment Token',
        symbol: 'DMTP',
        decimals: 6
    },
    reward: {
        name: 'DeMine Test Income Token',
        symbol: 'DMTI',
        decimals: 8
    }
};

const config = {
    tokenUri: 'DeMineNFT',
    royaltyBps: 100,
    wrappedTokenMeta: wrappedTokenMeta,
    accounts: [
        process.env.DEPLOYER_DEV,
        process.env.ADMIN_DEV,
        process.env.CUSTODIAN_DEV
    ],
    maticdev: {
        alchemy: process.env.ALCHEMY_API_KEY_POLYGON_DEV,
        scan: process.env.POLYGON_SCAN_API_KEY,
        income: process.env.DMTR_POLYGON_DEV,
        payment: process.env.DMTP_POLYGON_DEV,
    },
    arbitrumdev: {
        alchemy: process.env.ALCHEMY_API_KEY_ARBITRUM_DEV
    },
    enableGasReporter: (process.env.REPORT_GAS) ? true : false
};

module.exports = config;

require('dotenv').config();

const wrappedTokenMeta = {
    payments: [
        {
            name: 'DeMine Test USD Token',
            symbol: 'DMTU',
            decimals: 6
        },
        {
            name: 'DeMine Test DAI Token',
            symbol: 'DMTD',
            decimals: 6
        }
    ],
    reward: {
        name: 'DeMine Test Reward Token',
        symbol: 'DMTR',
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
        factory: process.env.DEMINE_FACTORY_POLYGON_DEV,
        wrappedToken: {
            factory: process.env.TOKEN_FACTORY_POLYGON_DEV,
            reward: process.env.DMTR_POLYGON_DEV,
            payments: [
                process.env.DMTU_POLYGON_DEV,
                process.env.DMTD_POLYGON_DEV
            ]
        }
    },
    arbitrumdev: {
        alchemy: process.env.ALCHEMY_API_KEY_ARBITRUM_DEV
    },
    enableGasReporter: (process.env.REPORT_GAS) ? true : false
};

module.exports = config;

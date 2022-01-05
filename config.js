require('dotenv').config();

const config = {
    tokenUri: 'demine_nft_token',
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER_DEV,
        process.env.ADMIN_DEV,
        process.env.CUSTODIAN_DEV
    ],
    enableGasReporter: (process.env.REPORT_GAS) ? true : false,
    maticdev: {
        alchemy: process.env.ALCHEMY_API_KEY_POLYGON_DEV,
        scan: process.env.POLYGON_SCAN_API_KEY,
        reward: process.env.DMDR_POLYGON_DEV,
        payments: [
            process.env.DMTU_POLYGON_DEV,
            process.env.DMTD_POLYGON_DEV
        ],
        factory: process.env.DEMINE_FACTORY_POLYGON_DEV,
        tokenFactory: process.env.TOKEN_FACTORY_POLYGON_DEV
    },
    arbitrumdev: {
        alchemy: process.env.ALCHEMY_API_KEY_ARBITRUM_DEV
    },
};

module.exports = config;

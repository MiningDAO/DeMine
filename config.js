require('dotenv').config();

const env = process.env.NODE_ENV;

const dev = {
    tokenUri: 'demine_nft_token',
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER_DEV,
        process.env.ADMIN_DEV,
        process.env.CUSTODIAN_DEV
    ],
    maticdev: {
        alchemy: process.env.POLYGON_DEV_ALCHEMY_API_KEY,
        usdt: process.env.USDT_POLYGON_DEV,
        usdc: process.env.USDC_POLYGON_DEV,
        wbtc: process.env.WBTC_POLYGON_DEV
    },
    arbitrumdev: {
        alchemy: process.env.ARBITRUM_DEV_ALCHEMY_API_KEY
    }
};

const test = dev;

const config = {
    dev,
    test
};

module.exports = config[env ? env : 'test'];

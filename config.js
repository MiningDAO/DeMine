require('dotenv').config();

const wrappedTokenMeta = {
    payment: {
        name: 'DeMine Test Payment Token',
        symbol: 'DPAY',
        decimals: 6
    },
    btc: {
        name: 'DeMine Test Bitcoin',
        symbol: 'DBTC',
        decimals: 8
    },
    eth: {
        name: 'DeMine Test ETH Coin Coin',
        symbol: 'DETH',
        decimals: 18
    },
    fil: {
        name: 'DeMine Test FIL Coin',
        symbol: 'DFIL',
        decimals: 18
    }
};

const config = {
    tokenUri: 'https://www.demine.com/token/',
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER_DEV,
        process.env.ADMIN_DEV,
        process.env.CUSTODIAN_DEV
    ],
    hardhat: {
        payment: {
            metadata: wrappedTokenMeta['payment']
        },
        btc: {
            metadata: wrappedTokenMeta['btc']
        },
        eth: {
            metadata: wrappedTokenMeta['eth']
        },
        fil: {
            metadata: wrappedTokenMeta['fil']
        }
    },
    maticdev: {
        alchemy: process.env.ALCHEMY_API_KEY_POLYGON_DEV,
        scan: process.env.POLYGON_SCAN_API_KEY,
        payment: {
            wrapped: process.env.DPAY_POLYGON_DEV,
            metadata: wrappedTokenMeta['payment']
        },
        btc: {
            nft: process.env.DEMINE_NFT_BTC,
            wrapped: process.env.DBTC_POLYGON_DEV,
            metadata: wrappedTokenMeta['btc']
        },
        eth: {
            nft: process.env.DEMINE_NFT_ETH,
            wrapped: process.env.DETH_POLYGON_DEV,
            metadata: wrappedTokenMeta['eth']
        },
        fil: {
            nft: process.env.DEMINE_NFT_FIL,
            wrapped: process.env.DFIL_NFT_FIL,
            metadata: wrappedTokenMeta['fil']
        },
    },
    arbitrumdev: {
        alchemy: process.env.ALCHEMY_API_KEY_ARBITRUM_DEV
    },
    enableGasReporter: (process.env.REPORT_GAS) ? true : false
};

module.exports = config;

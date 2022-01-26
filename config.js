require('dotenv').config();

const config = {
    tokenUri: {
        btc: 'https://www.demine.com/nft/btc/',
        eth: 'https://www.demine.com/nft/eth/',
        fil: 'https://www.demine.com/nft/fil/'
    },
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER_DEV,
        process.env.ADMIN_DEV,
        process.env.CUSTODIAN_DEV
    ],
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
    matic: {
        alchemy: process.env.ALCHEMY_API_KEY_POLYGON_MAINNET,
        scan: process.env.POLYGON_SCAN_API_KEY,
        usd: {
            wrapped: process.env.DPAY_POLYGON_MAINNET
        },
        btc: {
            nft: process.env.DEMINE_NFT_BTC_PLOYGON_MAINNET,
            wrapped: process.env.DBTC_POLYGON_MAINNET
        },
        eth: {
            nft: process.env.DEMINE_NFT_ETH_PLOYGON_MAINNET,
            wrapped: process.env.DETH_POLYGON_MAINNET
        }
    },
    maticdev: {
        alchemy: process.env.ALCHEMY_API_KEY_POLYGON_DEV,
        scan: process.env.POLYGON_SCAN_API_KEY,
        usd: {
            wrapped: process.env.DPAY_POLYGON_DEV
        },
        btc: {
            nft: process.env.DEMINE_NFT_BTC_PLOYGON_DEV,
            wrapped: process.env.DBTC_POLYGON_DEV
        },
        eth: {
            nft: process.env.DEMINE_NFT_ETH_PLOYGON_DEV,
            wrapped: process.env.DETH_POLYGON_DEV
        },
        fil: {
            nft: process.env.DEMINE_NFT_FIL_POLYGON_DEV,
            wrapped: process.env.DFIL_NFT_FIL
        },
    },
    arbitrumdev: {
        alchemy: process.env.ALCHEMY_API_KEY_ARBITRUM_DEV
    },
    enableGasReporter: (process.env.REPORT_GAS) ? true : false
};

module.exports = config;

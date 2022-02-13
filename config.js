require('dotenv').config();
const fs = require('fs');
const path = require('path');
const BigNumber = require('bignumber.js');

const config = {
    tokenUriPrefix: 'https://www.hypertrons.com/api/v1/token',
    royaltyBps: 100,
    accounts: [
        process.env.DEPLOYER,
        process.env.ADMIN,
        process.env.GNOSIS,
    ],
    statePath: path.join(__dirname, './state/'),
    courier: {
        brand: process.env.COURIER_BRAND_ID,
        auth_token: process.env.COURIER_AUTH_TOKEN,
        recipient_id: process.env.COURIER_RECIPIENT_ID,
        profile: process.env.COURIER_PROFILE
    },
    alchemy: {
        matic: process.env.ALCHEMY_MATIC,
        maticdev: process.env.ALCHEMY_MATIC_DEV,
        rinkeby: process.env.ALCHEMY_RINKEBY
    },
    gnosisSafe: {
        api: {
            rinkeby: 'https://safe-transaction.rinkeby.gnosis.io',
            bsc: 'https://safe-transaction.bsc.gnosis.io'
        },
        admin: {
            bsc: '0x782A6a9Bc11Fb6e8320b92f2217AfD80f813Bd05',
            rinkeby: '0xf24c00BafB6Cb10C5EA13Fa896526df604EE2B19',
        }
    },
    hashPerToken: {
        btc: new BigNumber('1e+12'),
    },
    antpool: {
        api: 'https://v3.antpool.com/api/',
        userId: process.env.ANTPOOL_SIGN_ID,
        key: process.env.ANTPOOL_KEY,
        secret: process.env.ANTPOOL_SECRET,
        feePercent: 0.005,
    },
    earningToken: {
        bsc: {
            btc: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'
        }
    },
    binance: {
        prod: {
            key: process.env.BINANCE_KEY,
            secret: process.env.BINANCE_SECRET,
            api: 'https://api.binance.com'
        },
        test: {
            key: process.env.BINANCE_TEST_KEY,
            secret: process.env.BINANCE_TEST_SECRET,
            api: 'https://testnet.binance.vision'
        }
    },
    scan: {
        bsc: {
            api: "https://api.bscscan.com/api",
            key : process.env.BSC_SCAN_KEY
        },
        bscdev: {
            api: "https://api-testnet.bscscan.com/api",
            key: process.env.BSC_SCAN_KEY
        }
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
            decimals: 18
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

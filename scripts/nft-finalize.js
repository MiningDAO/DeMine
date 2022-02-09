const { ethers, run } = hre = require("hardhat");
const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");

async function main() {
    const coin = 'btc';
    const admin = await config.admin(hre);

    if (admin.signer == undefined && hre.network.name == 'bsc') {
        await run('binance-withdraw', {coin: coin});
    }
    const endOfYesterday = time.startOfDay(new Date());
    const finalized = (await erc1155.finalized()).toNumber();
    if (finalized == 0) {
        await run(
            'nft-admin-finalize',
            {coin: coin, timestamp: endOfYesterday}
        );
    } else if (finalized == endOfYesterday - 86400) {
        await run('nft-admin-finalize', {coin: coin});
    } else {
        logger.error('Yesterday is not finalized');
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

const { localConfig } = require("hardhat");
const time = require("../lib/time.js");
const antpool = require("../lib/antpool.js");

const logger = require('../lib/logger.js');
const console = logger.rawLogger.transports.find(
    t => t.name == 'console'
);
console.level = 'debug';

async function main() {
    const coin = 'btc';
    logger.info(
        await antpool.statsYesterday(localConfig.antpool, coin)
    );

    const finalizing = time.toEpoch(new Date('2022-02-08'));
    logger.info(
        await antpool.stats(localConfig.antpool, coin, finalizing)
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

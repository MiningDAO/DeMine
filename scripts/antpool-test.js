const { localConfig } = require("hardhat");
const time = require("../lib/time.js");
const antpool = require("../lib/antpool.js");
const logger = require("../lib/logger.js");

async function main() {
    const coin = 'btc';
    const startDate = time.toEpoch(new Date('2022-02-02'));
    const today = time.startOfDay(new Date());
    for (let i = startDate; i <= today; i += 86400) {
        logger.info(
            await antpool.stats(localConfig.antpool, coin, i)
        );
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

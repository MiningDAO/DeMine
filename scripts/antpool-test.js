const { localConfig } = require("hardhat");
const time = require("../lib/time.js");
const antpool = require("../lib/antpool.js");

async function main() {
    const coin = 'btc';
    logger.info(
        await antpool.statsYesterday(localConfig.antpool, coin)
    );

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

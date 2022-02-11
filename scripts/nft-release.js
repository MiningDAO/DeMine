const { run } = hre = require("hardhat");
const logger = require("../lib/logger.js");

async function main() {
    const coin = 'btc';
    const weekly = await run(
        'nft-tokens',
        {tokens: "2022-02-01,2023-02-01,weekly"}
    );
    const ids = weekly.map(w => w.toString()).join(',');
    const amounts = Array(weekly.length).fill(100).join(',');

    await run(
        'nft-admin-release',
        {coin: coin, to: '0x80bE6B1Ee5427cb58eB8A8a5702986b5d2E55665', ids: ids, amounts: amounts}
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

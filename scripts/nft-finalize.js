const { ethers, run } = hre = require("hardhat");
const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");
const state = require("../lib/state.js");

async function main() {
    const coin = 'btc';
    const admin = await config.admin(hre);

    if (hre.network.name == 'bsc') {
        await run('binance-withdraw', {coin: coin});
    }

    const nft = state.loadNFTClone(hre, coin).target;
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const finalized = (await erc1155.finalized()).toNumber();
    const endOfYesterday = time.startOfDay(new Date());
    await run(
        'nft-admin-finalize',
        {coin: coin, timestamp: endOfYesterday}
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

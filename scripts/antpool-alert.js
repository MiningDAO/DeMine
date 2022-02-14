const { localConfig } = require("hardhat");
const BN = require("bignumber.js");
const time = require("../lib/time.js");
const antpool = require("../lib/antpool.js");
const logger = require("../lib/logger.js");
const state = require("../lib/state.js");
const token = require("../lib/token.js");
const courier = require("../lib/courier.js");

async function check(coin, slippage) {
    const hashrate = await antpool.hashrate(
        localConfig.antpool, coin
    );
    const hashPerToken = localConfig.hashPerToken[coin];
    // per API the returned result is in MH/s
    const factor = antpool.unitToFactor('MH/s');
    const hashrateDecimal = new BN(hashrate.last1h).times(factor).div(hashPerToken);

    const nft = state.loadNFTClone(hre, coin).target;
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const endOfToday = time.startOfDay(new Date()) + 86400;
    const stats = await token.supplyOf(erc1155, endOfToday);
    const tokenReleased = new BN(stats.tokenReleased.toString());

    const hashrateMsg = `Hashrate=${hashrateDecimal} TH, `
        + `ReleasedToken=${tokenReleased.toString()}`;
    if (hashrateDecimal.lt(tokenReleased.times(1 - slippage))) {
        const workflow = 'antpool-hashrate-check-e2e';
        const msg = `Last 1h Hashrate is lower than token supply! `
            + `${hashrateMsg}, check details at https://v3.antpool.com/dashboard`;
        await courier.notifyE2EFailure(hre, coin, workflow, msg);
    } else {
        logger.info(`Everything looks fine so far! ${hashrateMsg}`);
    }

}

async function main() {
    await check('btc', 0.1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

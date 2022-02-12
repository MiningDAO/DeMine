const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");
const state = require("../lib/state.js");
const courier = require('../lib/courier.js');

task('nft-finalize-e2e', 'withdraw and finalize')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('skipPrompts', 'if to skip prompts')
    .setAction(async (args, { ethers, localConfig } = hre) => {
        try {
            const admin = await config.admin(hre);
            if (hre.network.name == 'bsc') {
                localConfig.binance.skipPrompts = args.skipPrompts;
                logger.info("Will withdraw balance from binance to admin");
                await binance.withdrawAll(hre, args.coin, admin.address);
            }

            const nft = state.loadNFTClone(hre, args.coin).target;
            const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
            const startTs = time.startOfDay(new Date('2022-02-02'));
            var finalized = (await erc1155.finalized()).toNumber();
            localConfig.gnosisSafe.skipPrompts = args.skipPrompts;
            if (finalized == 0) {
                await run(
                    'nft-admin-finalize',
                    {
                        coin: args.coin,
                        timestamp: startTs
                    }
                );
                finalized = startTs;
            }

            const endTs = time.startOfDay(new Date());
            for (let i = finalized + 86400; i <= endTs; i += 86400) {
                await run(
                    'nft-admin-finalize',
                    { coin: args.coin, timestamp: i }
                );
            }
        } catch(err) {
            console.log('catch');
            console.log(err);
            return;
            await courier.notifyFailure(
                hre,
                args.coin,
                'NFT Finalize e2e workflow failed',
                err
            );
        }
    });

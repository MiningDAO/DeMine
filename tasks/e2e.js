const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");
const utils = require('../lib/utils.js');
const common = require('../lib/common.js');
const state = require("../lib/state.js");
const gnosis = require('../lib/gnosis.js');
const courier = require('../lib/courier.js');

function aggregate(txes) {
    var res = {};
    for (let i = 1; i <= txes.length; i++) {
        const {tx, signer, contract, func, args} = txes[i];
        res['tx_' + i] = tx;
        res['signer_' + i] = signer.address;
        res['contract_' + i] = contract.address;
        res['func_' + i] = func;
        res['args_' + i] = args;
    }
    return res;
}

async function exec(hre, admin, txes, note, options) {
    if (admin.type == 'GNOSIS') {
        const {safe, service} = hre.shared.gnosis;
        const safeTx = txes.length == 1
            ? txes[0]
            : await safe.createTransaction(txes.map(tx => tx.tx.data));
        const request = await gnosis.propose(
            safe, service, safeTx, options
        );
        const aggregated = aggregate(txes);
        await courier.notifyGnosis(
            hre,
            args.coin,
            request,
            {
                Workflow: 'nft-finalize-e2e',
                "Number of operation": txes.length,
                ...aggregated,
            },
            note
        );
        return request;
    } else {
        const txReceipts = [];
        for (const tx of txes) {
            txReceipts.push(await common.execTx(
                hre, admin.signer, tx.tx, options
            ));
        }
        return txReceipts;
    }
}

task('nft-finalize-e2e', 'withdraw and finalize')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('skipPrompts', 'if to skip prompts')
    .setAction(async (args, { ethers, localConfig } = hre) => {
        try {
            const admin = await config.admin(hre);
            if (hre.network.name == 'bsc') {
                const func = async() => {
                    await binance.withdrawAll(hre, args.coin, admin.address);
                };
                args.skipPrompts ? await func() : await utils.prompts(func);
                logger.info("Will withdraw balance from binance to admin")
            }

            hre.shared.gnosis = await gnosis.getSafe(hre, admin);
            const nft = state.loadNFTClone(hre, args.coin).target;
            const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
            const earningToken = await ethers.getContractAt(
                '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
                await erc1155Facet.earningToken()
            );
            const note = {
                [earningToken.address]: await earningToken.symbol(),
                [nft]: 'DeMineNFT',
                [admin.address]: 'DeMineAdmin(Gnosis Safe)',
                [admin.signer.address]: 'DeMineAdmin(EOA)',
            };

            var finalized = (await erc1155.finalized()).toNumber();
            var tx = [];
            if (finalized == 0) {
                finalized = time.toEpoch(new Date('2022-02-02T00:00:00Z'));
                tx.push(await run(
                    'nft-admin-finalize',
                    {
                        coin: args.coin,
                        timestamp: finalized,
                        dryrun: true,
                    }
                ));
            }

            finalized = time.toEpoch(new Date('2022-02-08T00:00:00Z'));
            const endTs = time.startOfDay(new Date());
            for (; finalized < endTs; finalized += 86400) {
                tx.push(await run(
                    'nft-admin-finalize',
                    {
                        coin: args.coin,
                        timestamp: finalized + 86400,
                        dryrun: true,
                    }
                ));
            }
            return await exec(hre, admin, tx, note, {skipPrompts: args.skipPrompts});
        } catch(err) {
            await courier.notifyE2EFailure(
                hre,
                args.coin,
                'NFT Finalize e2e workflow failed',
                JSON.stringify({error: err})
            );
        }
    });

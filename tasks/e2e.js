const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");
const utils = require('../lib/utils.js');
const common = require('../lib/common.js');
const state = require("../lib/state.js");
const gnosis = require('../lib/gnosis.js');
const courier = require('../lib/courier.js');
const binance = require('../lib/binance.js');

const workflow = 'nft-finalize-e2e';

function genSafeRequest(request) {
    return [
        {
            key: 'SenderAddress',
            value: request.senderAddress,
        },
        {
            key: 'SafeAddress',
            value: request.safeAddress,
        },
        {
            key: 'SafeTxHash',
            value: request.safeAddress,
        },
        {
            key: 'Interact With',
            value: request.safeTransaction.data.to,
        },
        {
            key: 'Calldata',
            value: request.safeTransaction.data.data,
        }
    ];
}

function genKV(obj) {
    return Object.keys(obj).map(k => ({key: k, value: obj[k]}));
}

function genOperation(i, request, context) {
    const {tx, signer, contract, func, args} = request;
    return {
        index: i,
        senderAddress: signer.address,
        contractAddress: contract.address,
        func: func,
        args: args.map(([k, v]) => k + ': ' + v).join('\n'),
        calldata: tx.data.data,
        operation: genKV(context),
    };
}

function genOperations(requests) {
    var result = [];
    for (let i = 0; i < requests.length; i++) {
        const {request, context} = requests[i];
        result.push(genOperation(i + 1, request, context));
    }
    return result;
}

async function exec(hre, coin, admin, requests, options) {
    if (admin.type == 'GNOSIS') {
        const {safe, service} = hre.shared.gnosis;
        const safeTx = requests.length == 1
            ? requests[0].request.tx
            : await safe.createTransaction(
                requests.map(req => req.request.tx.data)
            );
        const {request: safeReq} = await gnosis.propose(
            safe, service, safeTx, options
        );
        await courier.notifyGnosis(
            hre,
            coin,
            workflow,
            genSafeRequest(safeReq),
            genOperations(requests)
        );
        return safeReq;
    } else {
        const txReceipts = [];
        // do this in order incase there is dependencies between txes
        for (const req of requests) {
            txReceipts.push(await common.execTx(
                hre, admin.signer, req.request.tx, options
            ));
        }
        return txReceipts;
    }
}

task('nft-finalize-e2e', 'withdraw and finalize')
    .addParam('coin', 'Coin of DeMineNFT')
    .addFlag('skipPrompts', 'if to skip prompts')
    .addFlag('enforce', 'enforce option for nft-admin-finalize task')
    .setAction(async (args, { ethers, localConfig } = hre) => {
        try {
            const admin = await config.admin(hre);
            if (hre.network.name == 'bsc') {
                logger.info("Will withdraw balance from binance to admin")
                await binance.withdrawAll(hre, args.coin, admin.address, args.skipPrompts);
            }
            if (admin.type == 'GNOSIS') {
                hre.shared.gnosis = await gnosis.getSafe(hre, admin);
            }

            const nft = state.loadNFTClone(hre, args.coin).target;
            const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
            const earningToken = await ethers.getContractAt(
                '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
                await erc1155.earningToken()
            );

            var finalized = (await erc1155.finalized()).toNumber();
            const endTs = time.startOfDay(new Date());
            if (finalized == endTs) {
                const finalizedAsDate = new Date(finalized * 1000).toISOString();
                logger.info(`No need to finalize, lastest finalized is ${finalizedAsDate}`);
            }

            var requests = [];
            if (finalized == 0) {
                finalized = time.toEpoch(new Date('2022-02-02T00:00:00Z'));
                requests.push(await run(
                    'nft-admin-finalize',
                    {
                        coin: args.coin,
                        timestamp: finalized,
                        enforce: args.enforce,
                        dryrun: true,
                    }
                ));
            }

            for (; finalized < endTs; finalized += 86400) {
                requests.push(await run(
                    'nft-admin-finalize',
                    {
                        coin: args.coin,
                        timestamp: finalized + 86400,
                        enforce: args.enforce,
                        dryrun: true,
                    }
                ));
            }
            return await exec(
                hre, args.coin, admin, requests, {skipPrompts: args.skipPrompts}
            );
        } catch(err) {
            await courier.notifyE2EFailure(
                hre,
                args.coin,
                workflow,
                err.toString()
            );
        }
    });

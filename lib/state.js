const path = require('path');
const fs = require('fs');
const { URLSearchParams } = require('url');
const axios = require('axios');
const lodash = require('lodash');
const token = require('./token.js');
const logger = require('npmlog');
const address0 = '0x0000000000000000000000000000000000000000';

function statePath(hre, coin) {
    const p = path.join(hre.localConfig.statePath, hre.network.name, coin);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
    return p;
}

function contractPath(hre, coin) {
    return path.join(statePath(hre, coin), './contracts.json');
}

function supplyPath(hre, coin, address) {
    return path.join(
        statePath(hre, coin),
        `./${address}-supply.json`
    );
}

function txPath(hre, coin, address) {
    return path.join(
        statePath(hre, coin),
        `./${address}-logs.json`
    );
}

async function query(config, params) {
    params['apikey'] = config.key;
    const qs = new URLSearchParams(params);
    const instace = axios.create();
    const url = `${config.api}?${qs.toString()}`;
    logger.info(`Posting ${url}`);
    const response = await instace.request({
        url: url,
        method: 'POST'
    });
    assert(
        response.data.status == "1",
        'Respones error: ' + JSON.stringify(response.data)
    );
    return response.data.result;
}

function loadJSON(p) {
    const content = fs.readFileSync(p, {flag: 'a+'});
    if (content.length == 0) {
        return {};
    }
    return JSON.parse(content);
}

// {
//    source: where the contract is cloned from,
//    target: cloned nft contract address,
//    fallback: fallback contract address,
//    txReceipt: tx receipt object
// }
function updateContract(hre, coin, update) {
    const p = contractPath(hre, coin);
    const contracts = loadJSON(p);
    fs.writeFileSync(
        p,
        JSON.stringify(lodash.merge(contracts, update), null, 2)
    );
}

function tryLoadContracts(hre, coin) {
    const p = contractPath(hre, coin);
    return loadJSON(p);
}

function tryLoadWrappedClone(hre, coin) {
    const p = contractPath(hre, coin);
    return loadJSON(p).wrapped;
}

function loadNFTClone(hre, coin) {
    const p = contractPath(hre, coin);
    return require(p).nft;
}

function loadTxReceipts(p) {
    if(!fs.existsSync(p)) {
        return [];
    }
    const content = fs.readFileSync(p);
    return content.split('\n').map(l => JSON.parse(l));
}

async function getLogs(
    config, fromBlock, address
) {
    return query(config, {
        module: 'logs',
        action: 'getLogs',
        fromBlock: fromBlock,
        toBlock: 'lastest',
        address: address,
        topic1: address0,
        topic1_2_opr: 'or',
        topic2: address0
    });
}

function updateSupply(hre, txReceipt, supply) {
    const [ids, amounts] = hre.ethers.utils.defaultAbiCoder.decode(
        ['uint256[]', 'uint256[]'],
        tx.data
    );
    for (let i = 0; i < ids.length; i++) {
        const id = token.decode(ids[i]);
        for (let ts = id.start + 86400; ts <= id.end; ts += 86400) {
            // mint
            if (tx.topics[1] == address0) {
                supply[ts] = hre.ethers.BigNumber.from(
                    supply[ts]
                ).add(amounts[i]).toString();
            }
            // burn
            if (tx.topics[2] == address0) {
                supply[ts] = hre.ethers.BigNumber.from(
                    supply[ts]
                ).sub(amounts[i]).toString();
            }
        }
    }
    return supply;
}

// Ordered lines of log JSON object
function initSupply(hre, coin, nft) {
    const fromBlock = nft.txReceipt.blockNumber;
    logger.info(`Reading logs from block ${fromBlock} to latest block`);
    const logs = getLogs(
        hre.localConfig.scan[hre.network.name],
        fromBlock,
        nft.target,
    );
    file.writeFileSync(
        txPath(hre, coin, nft.target),
        logs.map(tx => JSON.stringify(tx)).join('\n') + '\n'
    );
    logger.info(`Logs updated`);

    var supply = {};
    logger.info(`Updating supply info`);
    for (const log of logs) {
        updateSupply(hre, log, supply)
    }
    fs.writeFileSync(
        supplyPath(hre, coin, nft.target),
        JSON.stringify(supply, null, 2)
    );
    logger.info(`Supply info updated`);
    return logs;
}

function getSupply(hre, coin, nft, timestamp) {
    const p = supplyPath(hre, coin, nft.target);
    logger.info(`Loading supply from ${p}`);
    const supply = loadJSON(p)[timestamp] || 0;
    return hre.ethers.BigNumber.from(supply);
}

function updateAndSaveSupply(hre, coin, nft, txReceipt) {
    const log = txReceipt.logs.filter(
        l => l.topics[1] == address0 || l.topics[2] == address0
    );
    fs.appendFileSync(
        txPath(hre, coin, nft.target),
        JSON.stringify(log),
        { flag: 'a+' }
    );
    const supplyPath = supplyPath(hre, coin, nft.target);
    const supply = require(supplyPath);
    updateSupply(hre, log, supply);
    fs.writeFileSync(
        supplyPath(hre, coin, nft.target),
        JSON.stringify(supply, null, 2)
    );
    logger.info(`Supply info updated`);
}

module.exports= {
    loadNFTClone,
    tryLoadWrappedClone,
    tryLoadContracts,
    updateContract,
    updateAndSaveSupply,
    initSupply,
    getSupply
}

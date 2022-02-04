const { URLSearchParams } = require('url');
const axios = require('axios');
const path = require('path');
const lodash = require('lodash');
const token = require('./token.js');
const logger = require('npmlog');

function statePath(hre, coin) {
    const path = path.join(hre.localConfig.statePath, hre.network.name, coin);
    if (!fs.existsSync(path)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    return path;
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
        `./${address}-txReceipts.json`
    );
}

async function query(config, params) {
    params['apikey'] = config.key;
    const qs = new URLSearchParams(params);
    const instace = axios.create();
    const response = await instace.request({
        url: `${config.api}?${qs.toString()}`,
        method: 'POST'
    });
    assert(
        response.data.status == "1",
        'Respones error: ' + JSON.stringify(response.data)
    );
    return response.data.result;
}

function loadJSON(path) {
    const content = fs.readFileSync(path, {flag: 'a+'});
    if (content.length == 0) {
        return {};
    }
    return JSON.parse(content);
}

// {
//    source: where the contract is cloned from,
//    target: cloned nft contract address,
//    txReceipt: tx receipt object
// }
function updateContract(hre, coin, update) {
    const contractPath = contractPath(hre, coin);
    const contracts = loadJSON(contractPath);
    fs.writeFileSync(
        contractPath,
        JSON.stringify(lodash.merge(contracts, update), null, 2)
    );
}

function loadNFTClone(hre, coin) {
    const contractPath = contractPath(hre, coin);
    const contracts = require(contractPath);
    return contracts.nft;
}

function loadTxReceipts(path) {
    if(!fs.existsSync(path)) {
        return [];
    }
    const content = fs.readFileSync(path);
    return content.split('\n').map(l => JSON.parse(l));
}

async function getLatestTxReceipts(
    config, fromBlock, address
) {
    return query(config, {
        module: 'logs',
        action: 'getLogs',
        fromBlock: fromBlock,
        toBlock: 'lastest',
        address: address,
        topic1: '0x0000000000000000000000000000000000000000'
    });
}

// Ordered lines of tx receipt JSON object
function getAndUpdateTxReceipts(hre, coin, nft) {
    const path = txPath(hre, coin, nft.target);
    logger.info(`Loading tx receipts from ${path}`);
    const txReceipts = loadTxReceipts(path);
    const fromBlock = txReceipts.length > 0
        ? txReceipts[txReceipts.length - 1].blockNumber + 1
        : nft.txReceipt.blockNumber;
    logger.info(`Reading tx receipts from block ${fromBlock} to latest block`);
    const newTxReceipts = getLatestTxReceipts(
        hre.localConfig.scan[hre.network.name],
        fromBlock,
        nft.target,
    );
    file.appendFileSync(
        path,
        newTxReceipts.map(tx => JSON.stringify(tx)).join('\n') + '\n',
        {flag: 'a+'}
    );
    logger.info(`Tx receipts updated`);
    return newTxReceipts;
}

// { $timestamp: supply }
function getAndUpdateSupply(hre, coin, nft, timestamp) {
    const supplyPath = supplyPath(hre, coin);
    logger.info(`Loading supply from ${path}`);
    const supply = loadJSON(supplyPath);
    const txReceipts = getAndUpdateTxReceipts(hre, coin);
    logger.info(`Updating supply info`);
    for (const tx of txReceipts) {
        const [ids, amounts] = hre.ethers.utils.defaultAbiCoder.decode(
            ['uint256[]', 'uint256[]'],
            tx.data
        );
        for (let i = 0; i < ids.length; i++) {
            const id = token.decode(ids[i]);
            for (let ts = id.start + 86400; ts <= id.end; ts += 86400) {
                supply[ts] = hre.ethers.BigNumber.from(
                    supply[ts]
                ).add(amounts[i]).toString();
            }
        }
    }
    fs.writeFileSync(supplyPath, JSON.stringify(supply, null, 2));
    logger.info(`Supply info updated`);
    return hre.ethers.BigNumber.from(supply[timestamp]);
}

module.exports= {
    loadNFTClone,
    updateContract,
    getAndUpdateSupply,
}

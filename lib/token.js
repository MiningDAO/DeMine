const time = require("./time.js");

function _genTokenId(start, end) {
    return {
        startTs: start,
        startDate: new Date(start * 1000).toISOString(),
        endTs: end,
        endDate: new Date(end * 1000).toISOString(),
    }
}

function genTokenId(endTs, type) {
    if (type == 'daily') {
        return _genTokenId(endTs - 86400, endTs);
    } else if (type == 'weekly') {
        return _genTokenId(endTs - 604800, endTs);
    } else if (type == 'biweekly') {
        return _genTokenId(endTs - 1209600, endTs);
    }
}

function genTokenIds(startTs, endTs, type) {
    var tokenIds = [];
    for (;startTs < endTs;) {
        const tokenId = genTokenId(endTs, type);
        if (tokenId.startTs >= startTs) {
            tokenIds.push(tokenId);
        }
        endTs = tokenId.startTs;
    }
    return tokenIds.reverse();
}

function encodeOne(ethers, id) {
    return ethers.BigNumber.from(id.startTs).shl(128).add(id.endTs);
}

function encode(ethers, tokenIds) {
    return tokenIds.map(t => encodeOne(ethers, t));
}

function decodeOne(id) {
    return _genTokenId(
        id.shr(128).toNumber(),
        id.mask(128).toNumber()
    );
}

function decode(ids) {
    return ids.map(id => decodeOne(ethers, id));
}

function validateTokenType(type) {
    return type == 'daily' || type == 'weekly' || type == 'biweekly';
}

function readableId(id) {
    const start = id.startDate.split('T')[0];
    const end = ids.endData.split('T')[0];
    return start + '-' + end;
}

function readableIds(ids) {
    return ids.map(id => readableId(id)).join(',')
}

async function supplyOf(ethers, erc1155, endOfDay) {
    const id = genTokenId(endOfDay, 'daily');
    const supply = await erc1155.supplyOf(token.encodeOne(ethers, id));
    for (let i = 0; i < 7; i++) {
        const id = genTokenId(endOfDay + i * 86400, 'weekly');
        const balance = await erc1155.supplyOf(token.encodeOne(ethers, id));
        supply.add(balance);
    }
    for (let i = 0; i < 14; i++) {
        const id = genTokenId(endOfDay + i * 86400 * 2, 'biweekly');
        const balance = await erc1155.supplyOf(token.encodeOne(ethers, id));
        supply.add(balance);
    }
    return supply;
}

module.exports = {
    genTokenId,
    genTokenIds,
    encodeOne,
    encode,
    decodeOne,
    decode,
    readableId,
    readableIds,
    supplyOf,
    validateTokenType
}

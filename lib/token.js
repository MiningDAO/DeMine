const time = require("./time.js");
const assert = require("assert");

function _genTokenId(start, end) {
    return {
        startTs: start,
        startDate: new Date(start * 1000).toISOString(),
        endTs: end,
        endDate: new Date(end * 1000).toISOString(),
    }
}

function genTokenId(startTs, type) {
    if (type == 'daily') {
        return _genTokenId(startTs, startTs + 86400);
    } else if (type == 'weekly') {
        return _genTokenId(startTs, startTs + 604800);
    } else if (type == 'biweekly') {
        return _genTokenId(startTs, startTs + 1209600);
    }
}

function genTokenIds(startTs, endTs, type) {
    if (type == 'weekly') {
        startTs = startTs % 604800 == 0
            ? startTs
            : startTs - startTs % 604800 + 604800;
    } else if (type == 'biweekly') {
        startTs = startTs % 1209600 == 0
            ? startTs
            : startTs - startTs % 1209600 + 1209600;
    }
    var tokenIds = [];
    for (;startTs < endTs;) {
        const tokenId = genTokenId(startTs, type);
        if (tokenId.endTs <= endTs) {
            tokenIds.push(tokenId);
        }
        startTs = tokenId.endTs;
    }
    return tokenIds;
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
    const end = id.endDate.split('T')[0];
    return '[' + start + ',' + end + ']';
}

function readableIds(ids) {
    return ids.map(id => readableId(id)).join(',')
}

async function supplyOf(ethers, erc1155, endOfDay) {
    const custodian = await erc1155.custodian();
    const id = encodeOne(ethers, genTokenId(endOfDay - 86400, 'daily'));
    const balance = await erc1155.supplyOf(id);
    const locked = await erc1155.balanceOf(custodian, id);
    var supply = balance.sub(locked);
    for (let i = 0; i < 7; i++) {
        const id = encodeOne(
            ethers,
            genTokenId(endOfDay + i * 86400 - 7 * 86400, 'weekly')
        );
        const balance = await erc1155.supplyOf(id);
        const locked = await erc1155.balanceOf(custodian, id);
        supply = supply.add(balance).sub(locked);
    }
    for (let i = 0; i < 14; i++) {
        const id = encodeOne(
            ethers,
            genTokenId(
                endOfDay + i * 86400 * 2 - 14 * 86400,
                'biweekly'
            )
        );
        const balance = await erc1155.supplyOf(id);
        const locked = await erc1155.balanceOf(custodian, id);
        supply = supply.add(balance).sub(locked);
    }
    return supply;
}

function parseTs(value) {
    if (time.validateDate(value)) {
        return time.toEpoch(new Date(value));
    } else {
        return parseInt(value);
    }
}

function parsePeriod(input) {
    const [start, end, type] = input.split(',');
    assert(validateTokenType(type), 'invalid token type');
    const startTs = parseTs(start);
    const endTs = parseTs(end) + 86400;
    assert(startTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    assert(endTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    return [startTs, endTs, type];
}

function parseTokenIds(tokens) {
    const [startTs, endTs, type] = parsePeriod(tokens);
    const tokenIds = genTokenIds(startTs, endTs, type);
    assert(tokenIds.length > 0, 'No token will be issued');
    return tokenIds;
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
    parseTokenIds,
    parseTs,
    validateTokenType
}

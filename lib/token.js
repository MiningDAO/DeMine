const BN = require("bignumber.js");
const ethers = require("ethers");
const assert = require("assert");
const time = require("./time.js");

function uri(hre, coin) {
    return [
        hre.localConfig.tokenUriPrefix,
        hre.network.name,
        coin.toLowerCase()
    ].join('/') + '/';
}

function _genTokenId(start, end, type) {
    return {
        startTs: start,
        startDate: new Date(start * 1000).toISOString(),
        endTs: end,
        endDate: new Date(end * 1000).toISOString(),
        type: type,
    }
}

function genTokenId(startTs, type) {
    if (type == 'daily') {
        return _genTokenId(startTs, startTs + 86400, type);
    } else if (type == 'weekly') {
        return _genTokenId(startTs, startTs + 604800, type);
    } else if (type == 'biweekly') {
        return _genTokenId(startTs, startTs + 1209600, type);
    }
    throw 'Invalid token type';
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

function encodeOne(id) {
    return ethers.BigNumber.from(id.startTs).shl(128).add(id.endTs);
}

function encode(tokenIds) {
    return tokenIds.map(t => encodeOne(t));
}

function decodeOne(id) {
    const startTs = id.shr(128).toNumber();
    const endTs = id.mask(128).toNumber();
    if (endTs - startTs == 86400) {
        return genTokenId(startTs, 'daily');
    } else if (endTs - startTs == 86400 * 7) {
        return genTokenId(startTs, 'weekly');
    } else if (endTs - startTs == 86400 * 14) {
        return genTokenId(startTs, 'biweekly');
    }
    throw 'Invalid token id';
}

function decode(ids) {
    return ids.map(id => decodeOne(id));
}

function validateTokenType(type) {
    return type == 'daily' || type == 'weekly' || type == 'biweekly';
}

function readableId(id) {
    const decoded = decodeOne(id);
    return '[' + decoded.startDate + ',' + decoded.endDate + ']';
}

function readableIds(ids) {
    return ids.map(id => readableId(id)).join(',')
}

async function tokenizedHashrate(erc1155, endOfDay) {
    const ids = [genTokenId(endOfDay - 86400, 'daily')];
    for (let i = 0; i < 7; i++) {
        ids.push(genTokenId(endOfDay + i * 86400 - 7 * 86400, 'weekly'));
    }
    for (let i = 0; i < 14; i++) {
        ids.push(genTokenId(
            endOfDay + i * 86400 * 2 - 14 * 86400,
            'biweekly'
        ));
    }
    const encoded = encode(ids);
    const custodian = await erc1155.custodian();
    const balances = await erc1155.supplyOfBatch(encoded);
    const locked = await erc1155.balanceOfBatch(
        Array(encoded.length).fill(custodian),
        encoded
    );
    var result = ethers.BigNumber.from(0);
    for (let i = 0; i < encoded.length; i++) {
        result = result.add(balances[i]).sub(locked[i]);
    }
    return new BN(result.toString());
}

function parseTs(value) {
    if (time.validateDate(value)) {
        return time.toEpoch(new Date(value + 'T00:00:00Z'));
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
    tokenizedHashrate,
    parseTokenIds,
    parseTs,
    validateTokenType,
    uri,
}

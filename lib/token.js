const time = require("./time.js");

function _genTokenId(start, end) {
    return {
        startTs: start,
        startDate: new Date(start * 1000).toISOString(),
        endTs: end,
        endDate: new Date(end * 1000).toISOString(),
    }
}

function genTokenId(startTs, type) {
    const today = time.startOfDay(new Date());
    if (type == 'daily') {
        return _genTokenId(startTs, startTs + 86400);
    } else if (type == 'weekly') {
        return _genTokenId(startTs, startTs + 604800);
    } else if (type == 'biweekly') {
        return _genTokenId(startTs, startTs + 1209600);
    }
}

function genTokenIds(startTs, endTs, type) {
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

module.exports = {
    genTokenId,
    genTokenIds,
    encodeOne,
    encode,
    decodeOne,
    decode,
    validateTokenType
}

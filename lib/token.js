const time = require("./time.js");

function genTokenId(start, type) {
    const today = time.startOfDay(new Date());
    if (type == 'daily') {
        return {start, end: start + 86400}
    } else if (type == 'weekly') {
        return {start, end: start + 604800};
    } else if (type == 'biweekly') {
        return {start, end: start + 1209600};
    }
}

function genTokenIds(start, end, type) {
    start = time.toEpoch(new Date(start));
    end = time.toEpoch(new Date(end)) + 86400;
    var tokenIds = [];
    for (;start < end;) {
        const tokenId = genTokenId(start, type);
        if (tokenId.end <= end) {
            tokenIds.push(tokenId);
        }
        start = tokenId.end;
    }
    return tokenIds;
}

function encodeOne(ethers, id) {
    return ethers.BigNumber.from(id.start).shl(128).add(id.end);
}

function encode(ethers, tokenIds) {
    return tokenIds.map(t => encodeOne(ethers, t));
}

function decodeOne(id) {
    return {
        start: id.shr(128).toNumber(),
        end: id.mask(128).toNumber()
    }
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
}

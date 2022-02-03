const assert = require("assert");

function epoch() {
    return Math.floor(new Date().getTime() / 1000)
}

function toEpoch(date) {
    return Math.floor(date.getTime() / 1000)
}

function yesterday() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
}

function future(days) {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    return future;
}

function day(timestamp) {
    return timestamp - timestamp % 86400;
}

function genTokenId(start, type) {
    const today = day(epoch());
    if (type == 'daily') {
        return {start, end: start + 86400}
    } else if (type == 'weekly') {
        return {start, end: start + 604800};
    } else if (type == 'biweekly') {
        return {start, end: start + 1209600};
    }
}

function genTokenIds(start, end, type) {
    start = toEpoch(new Date(start));
    end = toEpoch(new Date(end)) + 86400;
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

function days(start, end) {
    return Math.floor(
        (new Date(end).getTime() + 86400000 - new Date(start).getTime()) / 86400000
    );
}

function weeks(start, end) {
    return Math.floor(
        (new Date(end).getTime() + 86400000- new Date(start).getTime()) / (86400000 * 7)
    );
}

function biweeks(start, end) {
    return Math.floor(
        (new Date(end).getTime() + 86400000- new Date(start).getTime()) / (86400000 * 7 * 2)
    );
}

module.exports = {
    epoch: epoch,
    toEpoch: toEpoch,
    yesterday: yesterday,
    future: future,
    genTokenId: genTokenId,
    genTokenIds: genTokenIds,
    encodeOne: encodeOne,
    encode: encode,
    days: days,
    weeks: weeks,
    biweeks: biweeks
}

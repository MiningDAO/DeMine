const assert = require("assert");
const token = require("../lib/token.js");
const time = require("../lib/time.js");
const config = require("../lib/config.js");

function parseTs(value) {
    if (time.validateDate(value)) {
        return time.toEpoch(new Date(value));
    } else {
        return parseInt(value);
    }
}

function parsePeriod(input) {
    const [start, end, type] = input.split(',');
    assert(token.validateTokenType(type), 'invalid token type');
    const startTs = parseTs(start);
    const endTs = parseTs(end) + 86400;
    assert(startTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    assert(endTs % 86400 == 0, 'invalid start date, must be 00:00:00 of day');
    return [startTs, endTs, type];
}

function parseTokenIds(tokens) {
    const [startTs, endTs, type] = parsePeriod(tokens);
    const tokenIds = token.genTokenIds(startTs, endTs, type);
    assert(tokenIds.length > 0, 'No token will be issued');
    return tokenIds;
}

function validateCommon(args, hre) {
    assert(network.name !== 'hardhat', 'Not supported at hardhat network');
    config.validateCoin(args.coin);
}

module.exports = {
    parseTs,
    parseTokenIds,
    validateCommon,
}

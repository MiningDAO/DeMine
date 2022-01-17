// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

struct TokenId {
    uint128 pool;
    uint128 cycle;
}

library LibTokenId {
    function encode(uint128 pool, uint128 cycle) internal pure returns(uint) {
        return (uint256(pool) << 128) + cycle;
    }

    function decode(uint id) internal pure returns(TokenId memory) {
        return TokenId(uint128(id >> 128), uint128(id));
    }
}

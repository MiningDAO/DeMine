// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library Util {
    function ceil(uint a, uint m) internal pure returns(uint) {
        return ((a + m - 1) / m) * m;
    }

    function max3(uint a, uint b, uint c) internal pure returns(uint) {
        return a > b ? max2(a, c) : max2(b, c);
    }

    function max2(uint a, uint b) internal pure returns(uint) {
        return a > b ? a : b;
    }

    function uint128max2(uint128 a, uint128 b) internal pure returns(uint128) {
        return a > b ? a : b;
    }

    function min2(uint a, uint b) internal pure returns(uint) {
        return a < b ? a : b;
    }

    function uint128min2(uint128 a, uint128 b) internal pure returns(uint128) {
        return a < b ? a : b;
    }

    function min3(uint a, uint b, uint c) internal pure returns(uint) {
        return a < b ? min2(a, c) : min2(b, c);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

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

    function min2(uint a, uint b) internal pure returns(uint) {
        return a < b ? a : b;
    }

    function min3(uint a, uint b, uint c) internal pure returns(uint) {
        return a < b ? min2(a, c) : min2(b, c);
    }
}

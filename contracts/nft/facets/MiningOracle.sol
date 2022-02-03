// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import './Base.sol';

abstract contract MiningOracle is Base {
    event Finalize(uint128 indexed, uint128 indexed, uint);

    function finalize(uint128 timestamp, uint earningPerToken) external onlyOwner {
        require(
            (timestamp - s.finalized) % 86400 == 0,
            'MiningOracle: you can only finalized daily'
        );
        s.daily[timestamp] = earningPerToken;
        uint128 thisWeek = timestamp - (timestamp - origin()) % 604800;
        s.weekly[thisWeek] += earningPerToken;
        s.finalized = timestamp;
        emit Finalize(timestamp, thisWeek, earningPerToken);
    }

    function finalized() external view returns(uint128) {
        return s.finalized;
    }

    function earning(uint tokenId) external view returns(uint) {
        uint128 start = uint128(tokenId >> 128);
        uint128 end = uint128(tokenId);
        return _earning(start, end);
    }

    function _earning(uint128 start, uint128 end)
        internal
        view
        returns(uint value)
    {
        // daily token
        if (end - start == 86400) {
            value = s.daily[start];
        }
        // weekly token
        if (end - start == 604800) {
            value = s.weekly[start];
        }
    }

    function origin() public pure returns(uint128) {
        // 1615507200 = 2021-03-12 00:00:00 GMT
        return 1615507200;
    }
}

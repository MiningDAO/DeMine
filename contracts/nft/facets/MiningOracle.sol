// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import './Base.sol';

abstract contract MiningOracle is Base {
    event Finalize(uint128 indexed, uint);

    function finalize(uint128 timestamp, uint earningPerToken) external onlyOwner {
        require(
            timestamp > s.finalized && timestamp % 86400 == 0,
            'DeMineNFT: invalid timestamp'
        );
        s.finalized = timestamp;
        s.daily[timestamp] = earningPerToken;
        for(uint128 i = 0; i < 7; i++) {
            s.weekly[timestamp + i * 86400] += earningPerToken;
        }
        emit Finalize(timestamp, earningPerToken);
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
            value = s.daily[end];
        // weekly token
        } else if (end - start == 604800) {
            value = s.weekly[end];
        // biweekly token
        } else if (end - start == 1209600) {
            value = s.weekly[end] + s.weekly[end - 604800];
        }
    }
}

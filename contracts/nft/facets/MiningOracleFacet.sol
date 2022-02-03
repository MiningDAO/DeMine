// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '../interfaces/IMiningOracle.sol';
import '../lib/AppStorage.sol';

contract MiningOracleFacet is
    OwnableInternal,
    IMiningOracle
{
    AppStorage internal s;

    event Finalize(uint128 indexed, uint128 indexed, uint);

    function finalize(uint128 timestamp, uint earningPerToken) external onlyOwner {
        require(
            (timestamp - s.finalized) % 86400 == 0,
            'MiningOracle: you can only finalized daily'
        );
        s.daily[timestamp] = earningPerToken;
        uint128 thisWeek = week(timestamp);
        s.weekly[thisWeek] += earningPerToken;
        s.finalized = timestamp;
        emit Finalize(timestamp, thisWeek, earningPerToken);
    }

    function finalized() external override view returns(uint128) {
        return s.finalized;
    }

    function earning(uint tokenId)
        external
        override
        view
        returns(uint value)
    {
        uint128 start = uint128(tokenId >> 128);
        uint128 end = uint128(tokenId);
        // daily token
        if (end - start == 86400) {
            value = s.daily[start];
        }
        // weekly token
        if (end - start == 604800) {
            value = s.weekly[start];
        }
    }

    function origin() public override pure returns(uint128) {
        // 1643763600 = Wed, 02 Feb 2022 01:00:00 GMT in seconds
        return 1643763600;
    }

    function week(uint128 timestamp) private pure returns(uint128) {
        return timestamp - (timestamp - origin()) % 604800; // weekly
    }
}

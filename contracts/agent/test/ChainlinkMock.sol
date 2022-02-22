// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract ChainlinkMock is AggregatorV3Interface {
    function decimals() external override pure returns (uint8) {
        return uint8(8);
    }

    function description() external override pure returns (string memory) {
        return "blablabal";
    }

    function version() external override pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId)
      external
      override
      pure
      returns (
          uint80 roundId,
          int256 answer,
          uint256 startedAt,
          uint256 updatedAt,
          uint80 answeredInRound
      ) {
        roundId = _roundId;
        answer = 0;
        startedAt = 0;
        updatedAt = 0;
        answeredInRound = 0;
    }

    function latestRoundData()
      external
      override
      view
      returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
      ) {
      roundId = 100;
      answer = 4000000000000;
      startedAt = block.timestamp;
      updatedAt = block.timestamp;
      answeredInRound = 80;
    }
}

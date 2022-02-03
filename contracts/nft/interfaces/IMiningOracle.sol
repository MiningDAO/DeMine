// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/IERC165.sol';

interface IMiningOracle {
    function earning(uint tokenId) external view returns(uint);

    function finalized() external view returns(uint128);

    function origin() external pure returns(uint128);
}

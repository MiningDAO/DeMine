// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import './AppStorage.sol';

library LibAppStorage {
    function layout() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }

    function decreaseBalance(
        AppStorage storage s,
        address mortgager,
        uint256 tokenId,
        uint256 amount
    ) internal {
        uint256 balance = s.accounts[tokenId][mortgager].balance;
        require(balance > amount, 'DeMineAgent: no sufficient balance');
        s.accounts[tokenId][mortgager].balance = balance - amount;
    }

    function decreaseBalance(
        AppStorage storage s,
        address mortgager,
        uint256 tokenId,
        uint256 amount
    ) internal {
        uint256 balance = s.accounts[tokenId][mortgager].balance;
        require(balance > amount, 'DeMineAgent: no sufficient balance');
        s.accounts[tokenId][mortgager].balance = balance - amount;
    }
}

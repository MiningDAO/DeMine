// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../utils/CustodianStorage.sol';
import './ERC2981Storage.sol';
import './IERC2981.sol';

abstract contract ERC2981 is IERC2981, OwnableInternal {
    event TokenRoyaltyBpsSet(uint16);

    function setRoyaltyBps(uint16 bps) external onlyOwner {
        ERC2981Storage.layout().bps = bps;
        emit TokenRoyaltyBpsSet(bps);
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        uint16 bps = ERC2981Storage.layout().bps;
        address recipient = CustodianStorage.layout().saving;
        return (recipient, (value * bps) / 10000);
    }
}

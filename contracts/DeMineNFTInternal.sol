// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import './utils/ERC20PayableInternal.sol';
import './metadata/CycleMetadataStorage.sol';

abstract contract DeMineNFTInternal is ERC20PayableInternal, Context {
    event Cashout(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 reward
    );

    function _cashout(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) internal {
        CycleMetadataStorage.Layout storage l = CycleMetadataStorage.layout();
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 cycle = uint128(ids[i]);
            require(cycle <= l.cycle, "DeMineNFTInternal: unrewarded cycle");
            totalIncome += amounts[i] * l.cycles[cycle].reward;
        }
        pay(l.rewardToken, to, totalIncome);
        emit Cashout(_msgSender(), from, to, totalIncome);
    }
}

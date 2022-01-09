// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../lib/LibERC20Payable.sol';
import '../lib/LibAppStorage.sol';
import '../lib/LibRewardable.sol';
import '../lib/LibCustodian.sol';

contract ExternalFacet is PausableModifier {
    using LibAppStorage for AppStorage;
    AppStorage internal s;

    event Claim(address indexed, address indexed, uint128 indexed, address);
    event Cashout(
        address indexed operator,
        address indexed account,
        address indexed recipient,
        uint256 reward
    );

    function claimUnnamed(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external {
        _claim(address(0), payment, pool, cycles, amounts);
    }

    function claim(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external {
        _claim(msg.sender, payment, pool, cycles, amounts);
    }

    function _claim(
        address claimer,
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) internal whenNotPaused {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        AppStorage.Pool memory p = s.pools[pool];
        uint256 totalToPay;
        uint256 totalToCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            s.decreaseAllowance(id, claimer, amounts[i]);
            s.locked[cycle][pool] -= amounts[i];
            totalCost += p.tokenCost * amounts[i];
            totalToPay += (
                s.prices[id] > 0 ? s.prices[id] : p.tokenPrice;
            ) * amounts[i];
            ids[i] = id;
        }
        LibERC20Payable.payCustodian(payment, msg.sender, totalCost);
        LibERC20Payable.pay(payment, msg.sender, p.owner, totalToPay - totalCost);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
        emit Claim(msg.sender, claimer, pool, payment);
    }

    function cashout(
        address account,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        ERC1155WithAgentFacet(s.nft).burnBatch(
            msg.sender, account, ids, amounts
        );
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 cycle = uint128(ids[i]);
            require(
                cycle < s.rewardingCycle,
                "DeMineNFT: unrewarded cycle"
            );
            totalIncome += amounts[i] * s.cycles[cycle].reward;
        }
        IERC20(s.rewardToken).safeTransfer(recipient, totalIncome);
        emit Cashout(msg.sender, account, recipient, totalIncome);
    }
}

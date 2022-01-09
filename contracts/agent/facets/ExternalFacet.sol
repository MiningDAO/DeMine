// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../lib/LibAppStorage.sol';
import '../lib/LibCashoutInternal.sol';
import '../lib/LibCustodian.sol';

contract ExternalFacet is PausableModifier {
    using LibAppStorage for AppStorage;
    AppStorage internal s;

    event Claim(address indexed, address indexed, uint128 indexed, address);

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
        uint256 defaultPrice = s.pools[pool].tokenPrice;
        uint256 totalToPay;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            s.decreaseAllowance(id, claimer, amounts[i]);
            totalToPay += (
                s.prices[id] > 0 ? s.prices[id] : defaultPrice
            ) * amounts[i];
            ids[i] = id;
        }
        address custodian = LibCustodian.layout().checking;
        pay(payment, msg.sender, custodian, totalToPay);
        emit Claim(msg.sender, claimer, pool, payment);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
    }

    function cashout(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: cashout caller is not owner nor approved"
        );
        ERC1155WithAgentFacet(s.nft).burnBatch(msg.sender, from, ids, amounts);
        _cashout(from, to, ids, amounts);
    }
}

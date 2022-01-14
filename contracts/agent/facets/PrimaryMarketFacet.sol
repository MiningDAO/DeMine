// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/LibAppStorage.sol';
import '../lib/PricingStatic/sol';
import '../lib/PricingLinear/sol';

contract PrimaryMarketFacet is PausableModifier, PricingStatic, PricingLinear {
    AppStorage internal s;

    using LibAppStorage for AppStorage;
    using SafeERC20 for IERC20;

    event Invest(address indexed, address indexed, uint128 indexed, address);
    event TransferMortgage(address indexed, address indexed, uint256[], uint256[]);
    event IncreaseAllowance(
        address indexed,
        address indexed,
        uint256[],
        uint256[]
    );
    event DecreaseAllowance(
        address indexed,
        address indexed,
        uint256[],
        uint256[]
    );

    function increaseAllowance(
        address buyer,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            cycles.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            s.allowances[mortgager][buyer][cycles[i]] += amounts[i];
        }
        emit IncreaseAllowance(msg.sender, buyer, cycles, amounts;
    }

    function decreaseAllowance(
        address to,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            cycles.length == amounts.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 allowance = s.allowances[mortgager][buyer][cycles[i]];
            require(
                allowance >= amounts[i],
                "DeMineAgent: allowance will below zero"
            );
            s.allowances[mortgager][buyer][cycles[i]] = allowance - amounts[i];
        }
        emit DecreaseAllowance(msg.sender, buyer, cycles, amounts);
    }

    function investUnnamed(
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        _invest(address(0), mortgager, ids, amounts);
    }

    function invest(
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        _invest(msg.sender, mortgager, ids, amounts);
    }

    function _invest(
        address investor,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) internal whenNotPaused {
        require(
            ids.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint256
        ) internal view returns(uint256) priceF = LibPricing.priceOfFunc(l);
        uint256 tokenCost = s.tokenCost;
        uint256 lastUnbillingCycle = s.lastUnbillingCycle;
        uint256 totalToPay;
        uint256 totalToCost;
        uint256[] memory ids = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                ids[i] >= lastUnbillingCycle,
                'DeMineAgent: cycle not redeemable'
            );
            s.decreaseAllowance(from, ids[i], investor, amounts[i]);
            s.locked[cycle][pool] -= amounts[i];
            totalCost += tokenCost * amounts[i];
            totalToPay += priceF(l, from, ids[i]) * amounts[i];
        }
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), totalCost);
        IERC20(s.cost).safeTransferFrom(msg.sender, from, totalToPay - totalCost);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
        emit Invest(msg.sender, investor, pool);
    }

    function setPricingStrategy(
        AppStorage.PricingStrategy ps,
        bytes memory args
    ) external {
        PricingStorage.Layout storage l = PricingStorage.layout();
        l.settings[msg.sender].pricingStrategy = ps;
        LibPricing.initialize(l, s, msg.sender, args);
    }

    function tokenPrices(
        address mortgager,
        uint256[] calldata ids
    ) external view override returns(uint256[] memory) {
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint256
        ) internal view returns(uint256) priceF = LibPricing.priceOfFunc(l);
        uint256[] memory prices = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            prices[i] = priceF(l, mortgager, ids[i]);
        }
        return prices;
    }

    function getAllowances(
        address mortgager,
        address buyer,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = s.allowances[mortgager][buyer][ids[i]];
        }
        return result;
    }
}

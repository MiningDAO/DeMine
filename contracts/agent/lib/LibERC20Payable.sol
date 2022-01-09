// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibERC20Payable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Layout {
        EnumerableSet.AddressSet payments;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.ERC20Payable');

    modifier onlyERC20Payable(address payment) {
        require(
            layout().payments.contains(payment),
            "DeMineAgent: payment not supported"
        );
        _;
    }

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function pay(
        address payment,
        address payer,
        address payee,
        uint256 amount
    ) internal onlyERC20Payable(payment) {
        IERC20(payment).safeTransferFrom(payer, payee, amount);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import './LibAppStorage.sol';

library LibERC20Payable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    modifier onlyERC20Payable(address payment) {
        require(
            layout().payments[payment].supported,
            "DeMineAgent: payment not supported"
        );
        _;
    }

    function pay(
        address payment,
        address payer,
        address payee,
        uint256 amount
    ) internal onlyERC20Payable(payment) {
        IERC20(payment).safeTransferFrom(payer, payee, amount);
    }

    function payCustodian(
        address payment,
        address payer,
        uint256 amount
    ) internal {
        pay(payment, payer, LibAppStorage.layout().custodian, amount);
    }
}
